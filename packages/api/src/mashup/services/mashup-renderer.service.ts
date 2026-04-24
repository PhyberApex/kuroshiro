import type { Device } from '../../devices/devices.entity'
import type { MashupConfiguration } from '../entities/mashup-configuration.entity'
import type { MashupSlot } from '../entities/mashup-slot.entity'
import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PluginDataFetcherService } from '../../plugins/services/plugin-data-fetcher.service'
import { PluginRendererService } from '../../plugins/services/plugin-renderer.service'
import { PluginTransformService } from '../../plugins/services/plugin-transform.service'

@Injectable()
export class MashupRendererService {
  private readonly logger = new Logger(MashupRendererService.name)

  constructor(
    private readonly pluginDataFetcher: PluginDataFetcherService,
    private readonly pluginRenderer: PluginRendererService,
    private readonly pluginTransformer: PluginTransformService,
    private readonly configService: ConfigService,
  ) {}

  async renderMashup(mashupConfig: MashupConfiguration, device: Device): Promise<string> {
    this.logger.log(`Rendering mashup ${mashupConfig.id} for device ${device.id}`)

    const slotHtmls: Array<{ slot: MashupSlot, html: string }> = []

    // Render each slot (with error handling for partial renders)
    for (const slot of mashupConfig.slots) {
      try {
        const html = await this.renderSlot(slot, device)
        slotHtmls.push({ slot, html })
      }
      catch (err) {
        this.logger.error(`Failed to render plugin ${slot.plugin.id} in slot ${slot.id}: ${err.message}`)
        const errorHtml = this.errorPlaceholder(slot.plugin.name)
        slotHtmls.push({ slot, html: errorHtml })
      }
    }

    // Sort by order
    slotHtmls.sort((a, b) => a.slot.order - b.slot.order)

    // Build complete mashup HTML
    return this.buildMashupHtml(mashupConfig.layout, slotHtmls)
  }

  private async renderSlot(slot: MashupSlot, _device: Device): Promise<string> {
    const plugin = slot.plugin

    if (!plugin.dataSource || !plugin.templates || plugin.templates.length === 0) {
      throw new Error('Plugin missing data source or templates')
    }

    // Build template context
    const templateContext: any = {
      trmnl: {
        system: {
          timestamp_utc: Math.floor(Date.now() / 1000),
        },
        plugin_settings: {
          instance_name: plugin.name,
          strategy: 'polling',
          dark_mode: 'no',
          no_screen_padding: 'no',
        },
        user: {
          id: 'kuroshiro-user',
          locale: 'en',
        },
      },
    }

    // Fetch data
    let data = await this.pluginDataFetcher.fetchData(
      plugin.dataSource.method,
      plugin.dataSource.url,
      plugin.dataSource.headers,
      plugin.dataSource.body,
      templateContext,
    )

    // Apply transform if exists
    if (plugin.dataSource.transformJs) {
      data = this.pluginTransformer.transform(plugin.dataSource.transformJs, data)
    }

    // Find template (prefer 'full' layout for now, could support size variants later)
    const template = plugin.templates.find(t => t.layout === 'full') || plugin.templates[0]

    // Render unwrapped plugin content
    return await this.pluginRenderer.render(template.liquidMarkup, data)
  }

  private buildMashupHtml(layout: string, slotHtmls: Array<{ slot: MashupSlot, html: string }>): string {
    const viewsHtml = slotHtmls.map(({ slot, html }) =>
      `<div class="view ${slot.size}">${html}</div>`,
    ).join('\n    ')

    return `<html>
  <head>
    <link rel="stylesheet" href="https://usetrmnl.com/css/latest/plugins.css">
    <script src="https://usetrmnl.com/js/latest/plugins.js"></script>
  </head>
  <body class="environment trmnl">
    <div class="mashup mashup--${layout}">
    ${viewsHtml}
    </div>
  </body>
</html>`
  }

  private errorPlaceholder(_pluginName: string): string {
    const apiUrl = this.configService.get<string>('api_url')
    return `<div style="display: flex; align-items: center; justify-content: center; height: 100%;">
    <img src="${apiUrl}/screens/error.png" style="max-width: 100%; height: auto;" alt="Plugin error" />
  </div>`
  }
}
