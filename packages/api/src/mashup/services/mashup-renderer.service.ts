import type { DeviceSensor } from '../../device-sensors/entities/device-sensor.entity'
import type { Device } from '../../devices/devices.entity'
import type { MashupConfiguration } from '../entities/mashup-configuration.entity'
import type { MashupSlot } from '../entities/mashup-slot.entity'
import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { DeviceSensorsService } from '../../device-sensors/device-sensors.service'
import { PluginDataFetcherService } from '../../plugins/services/plugin-data-fetcher.service'
import { PluginRendererService } from '../../plugins/services/plugin-renderer.service'
import { PluginTemplateContextService } from '../../plugins/services/plugin-template-context.service'
import { PluginTransformService } from '../../plugins/services/plugin-transform.service'
import { getErrorMessage } from '../../utils/getErrorMessage'

@Injectable()
export class MashupRendererService {
  private readonly logger = new Logger(MashupRendererService.name)

  constructor(
    private readonly pluginDataFetcher: PluginDataFetcherService,
    private readonly pluginRenderer: PluginRendererService,
    private readonly pluginTransformer: PluginTransformService,
    private readonly configService: ConfigService,
    private readonly deviceSensors: DeviceSensorsService,
    private readonly pluginTemplateContext: PluginTemplateContextService,
  ) {}

  async renderMashup(mashupConfig: MashupConfiguration, device: Device): Promise<string> {
    this.logger.log(`Rendering mashup ${mashupConfig.id} for device ${device.id}`)

    const slotHtmls: Array<{ slot: MashupSlot, html: string }> = []
    const sensors = await this.deviceSensors.findForDevice(device.id)

    // Render each slot (with error handling for partial renders)
    for (const slot of mashupConfig.slots) {
      try {
        const html = await this.renderSlot(slot, sensors)
        slotHtmls.push({ slot, html })
      }
      catch (err) {
        const message = getErrorMessage(err)
        this.logger.error(`Failed to render plugin ${slot.plugin.id} in slot ${slot.id}: ${message}`)
        const errorHtml = this.errorPlaceholder(slot.plugin.name)
        slotHtmls.push({ slot, html: errorHtml })
      }
    }

    // Sort by order
    slotHtmls.sort((a, b) => a.slot.order - b.slot.order)

    return this.buildMashupHtml(mashupConfig.layout, slotHtmls)
  }

  private async renderSlot(slot: MashupSlot, sensors: DeviceSensor[]): Promise<string> {
    const plugin = slot.plugin

    if (!plugin.dataSources || plugin.dataSources.length === 0 || !plugin.templates || plugin.templates.length === 0) {
      throw new Error('Plugin missing data sources or templates')
    }

    const templateContext = this.pluginTemplateContext.build(plugin, sensors)

    // Fetch all of the plugin's data sources in parallel; a source that fails
    // gets an error marker instead of aborting the whole render (ADR-0005).
    // A literal-mode source has no fetch to make — it contributes its stored
    // value directly, with no call to the data fetcher at all.
    const results = await Promise.allSettled(
      plugin.dataSources.map(async (source) => {
        let rawData = await this.pluginDataFetcher.fetchOrLiteral(source, templateContext)
        if (source.transformJs) {
          rawData = this.pluginTransformer.transform(source.transformJs, rawData)
        }
        return rawData
      }),
    )

    const data: Record<string, unknown> = {}
    results.forEach((result, index) => {
      const name = plugin.dataSources[index].name
      data[name] = result.status === 'fulfilled'
        ? result.value
        : { error: true, message: result.reason?.message || String(result.reason) }
    })

    // Find template (prefer 'full' layout for now, could support size variants later)
    const template = plugin.templates.find(t => t.layout === 'full') || plugin.templates[0]

    // Render unwrapped plugin content
    return await this.pluginRenderer.render(template.liquidMarkup, { ...templateContext, ...data })
  }

  private buildMashupHtml(layout: string, slotHtmls: Array<{ slot: MashupSlot, html: string }>): string {
    const viewsHtml = slotHtmls.map(({ slot, html }) =>
      `<div class="view ${slot.size}">${html}</div>`,
    ).join('\n    ')

    return `<div class="mashup mashup--${layout}">
    ${viewsHtml}
    </div>`
  }

  private errorPlaceholder(_pluginName: string): string {
    const apiUrl = this.configService.get<string>('api_url')
    return `<div style="display: flex; align-items: center; justify-content: center; height: 100%;">
    <img src="${apiUrl}/screens/error.png" style="max-width: 100%; height: auto;" alt="Plugin error" />
  </div>`
  }
}
