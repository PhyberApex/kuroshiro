import type { DeviceSensor } from '../../device-sensors/entities/device-sensor.entity.js'
import type { Device } from '../../devices/devices.entity.js'
import type { MashupConfiguration } from '../entities/mashup-configuration.entity.js'
import type { MashupSlot } from '../entities/mashup-slot.entity.js'
import { Injectable, Logger } from '@nestjs/common'
import { DeviceSensorsService } from '../../device-sensors/device-sensors.service.js'
import { templateOfSize, templateSizeOfSlot } from '../../plugins/plugin-templates.js'
import { PluginRendererService } from '../../plugins/services/plugin-renderer.service.js'
import { PluginTemplateContextService } from '../../plugins/services/plugin-template-context.service.js'
import { getErrorMessage } from '../../utils/getErrorMessage.js'
import { MASHUP_SLOT_ERROR_STYLE, mashupSlotErrorHtml } from '../mashup-slot-error-template.js'

@Injectable()
export class MashupRendererService {
  private readonly logger = new Logger(MashupRendererService.name)

  constructor(
    private readonly pluginRenderer: PluginRendererService,
    private readonly deviceSensors: DeviceSensorsService,
    private readonly pluginTemplateContext: PluginTemplateContextService,
  ) {}

  async renderMashup(mashupConfig: MashupConfiguration, device: Device): Promise<string> {
    this.logger.log(`Rendering mashup ${mashupConfig.id} for device ${device.id}`)

    const slotHtmls: Array<{ slot: MashupSlot, html: string }> = []
    const sensors = await this.deviceSensors.findForDevice(device.id)
    let anySlotFailed = false

    // Render each slot (with error handling for partial renders)
    for (const slot of mashupConfig.slots) {
      try {
        const html = await this.renderSlot(slot, sensors)
        slotHtmls.push({ slot, html })
      }
      catch (err) {
        const message = getErrorMessage(err)
        this.logger.error(`Failed to render plugin ${slot.plugin.id} in slot ${slot.id}: ${message}`)
        anySlotFailed = true
        slotHtmls.push({ slot, html: mashupSlotErrorHtml(slot.plugin.name) })
      }
    }

    // Sort by order
    slotHtmls.sort((a, b) => a.slot.order - b.slot.order)

    return this.buildMashupHtml(mashupConfig.layout, slotHtmls, anySlotFailed)
  }

  private async renderSlot(slot: MashupSlot, sensors: DeviceSensor[]): Promise<string> {
    const plugin = slot.plugin

    const template = templateOfSize(plugin.templates, templateSizeOfSlot(slot.size))
    if (!template) {
      throw new Error('Plugin has no Template of the slot\'s size and no full one')
    }

    const { context } = await this.pluginTemplateContext.contextFor(plugin, sensors)

    // Render unwrapped plugin content
    return await this.pluginRenderer.render(template.liquidMarkup, context)
  }

  private buildMashupHtml(layout: string, slotHtmls: Array<{ slot: MashupSlot, html: string }>, anySlotFailed: boolean): string {
    const viewsHtml = slotHtmls.map(({ slot, html }) =>
      `<div class="view ${slot.size}">${html}</div>`,
    ).join('\n    ')
    const style = anySlotFailed ? `<style>${MASHUP_SLOT_ERROR_STYLE}</style>` : ''

    return `${style}<div class="mashup mashup--${layout}">
    ${viewsHtml}
    </div>`
  }
}
