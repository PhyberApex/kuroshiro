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
import { mashupPageHtml } from '../mashup-page.js'
import { renderedSlotDrawing } from '../mashup-slot-signals.js'

/** One slot's rendered markup, `null` when its Plugin could not be rendered. */
export interface RenderedSlot {
  slot: MashupSlot
  markup: string | null
}

export interface RenderedMashup {
  html: string
  slots: RenderedSlot[]
}

@Injectable()
export class MashupRendererService {
  private readonly logger = new Logger(MashupRendererService.name)

  constructor(
    private readonly pluginRenderer: PluginRendererService,
    private readonly deviceSensors: DeviceSensorsService,
    private readonly pluginTemplateContext: PluginTemplateContextService,
  ) {}

  /**
   * Renders every slot's Template, in slot order, and the Mashup's page from them. A slot
   * whose Plugin cannot be rendered has `null` markup and draws its failed-render drawing.
   */
  async renderMashup(mashupConfig: MashupConfiguration, device: Device): Promise<RenderedMashup> {
    this.logger.log(`Rendering mashup ${mashupConfig.id} for device ${device.id}`)

    const sensors = await this.deviceSensors.findForDevice(device.id)
    const slots: RenderedSlot[] = []
    for (const slot of [...mashupConfig.slots].sort((a, b) => a.order - b.order)) {
      try {
        slots.push({ slot, markup: await this.renderSlot(slot, sensors) })
      }
      catch (err) {
        this.logger.error(`Failed to render plugin ${slot.plugin.id} in slot ${slot.id}: ${getErrorMessage(err)}`)
        slots.push({ slot, markup: null })
      }
    }

    return { html: mashupPageHtml(mashupConfig.layout, slots.map(({ slot, markup }) => renderedSlotDrawing(slot, markup))), slots }
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
}
