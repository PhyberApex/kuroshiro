import type { TemplateProblem, TemplateSize } from 'kuroshiro-shared'
import type { MashupSlot } from '../../mashup/entities/mashup-slot.entity.js'
import type { Plugin } from '../entities/plugin.entity.js'
import type { PluginRenderContext } from './plugin-template-context.service.js'
import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { templateProblemOf } from 'kuroshiro-shared'
import { Repository } from 'typeorm'
import { DeviceModelsService } from '../../device-models/device-models.service.js'
import { Screen } from '../../screens/screens.entity.js'
import { getErrorMessage } from '../../utils/getErrorMessage.js'
import { templateOfSize } from '../plugin-templates.js'
import { withTrmnlDevice } from '../trmnl-device.js'
import { PluginRendererService } from './plugin-renderer.service.js'

/** A Template that Liquid could not render, as against a render that failed to be stored. */
export class TemplateRenderError extends Error {
  readonly problem: TemplateProblem

  constructor(readonly size: TemplateSize, cause: unknown) {
    const problem = templateProblemOf(cause)
    super(problem.message, { cause })
    this.problem = problem
  }
}

@Injectable()
export class PluginRenderCacheService {
  private mashupSlotRepository: Repository<MashupSlot>
  private readonly logger = new Logger(PluginRenderCacheService.name)

  constructor(
    private readonly renderer: PluginRendererService,
    @InjectRepository(Screen)
    private readonly screenRepository: Repository<Screen>,
    private readonly deviceModels: DeviceModelsService,
  ) {
    // Lazy injection to avoid circular dependency
    setTimeout(() => {
      try {
        this.mashupSlotRepository = this.screenRepository.manager.getRepository('MashupSlot')
      }
      catch {
        this.logger.debug('MashupSlot repository not available')
      }
    }, 0)
  }

  /**
   * Renders the `full` Template, the one a Screen on its own shows, once per
   * Screen of the Plugin from the same data, each told its own Device as
   * `trmnl.device` (ADR-0066), and caches each output to its Screen. Every
   * Screen is rendered before the first is written, so a Template that fails
   * for one caches nothing, and `isSuperseded` is asked once more before the
   * first write, so a render a newer one has overtaken writes nothing. A
   * Plugin on no Screen is still rendered once, without a Device, so a broken
   * Template is told on a scheduled render.
   */
  async renderAndCache(plugin: Plugin, context: PluginRenderContext['context'], isSuperseded?: () => boolean): Promise<void> {
    const template = templateOfSize(plugin.templates, 'full')
    if (!template) {
      return
    }

    const render = (deviceContext: PluginRenderContext['context']) => this.renderer.render(template.liquidMarkup, deviceContext).catch((error) => {
      throw new TemplateRenderError('full', error)
    })
    const screens = await this.screenRepository.find({ where: { plugin: { id: plugin.id } }, relations: { device: true } })
    if (screens.length === 0)
      await render(context)

    const rendered: Array<{ screen: Screen, html: string }> = []
    for (const screen of screens)
      rendered.push({ screen, html: await render(await withTrmnlDevice(context, screen.device, this.deviceModels)) })

    if (isSuperseded?.())
      return

    const generatedAt = new Date()
    for (const { screen, html } of rendered)
      await this.screenRepository.update(screen.id, { cachedPluginOutput: html, renderSignal: null, generatedAt })

    await this.invalidateMashupCaches(plugin.id)
  }

  async invalidateMashupCaches(pluginId: string): Promise<void> {
    if (!this.mashupSlotRepository) {
      return
    }

    try {
      const mashupsWithPlugin = await this.mashupSlotRepository.find({
        where: { plugin: { id: pluginId } },
        relations: { mashupConfiguration: { screen: true } },
      })

      for (const slot of mashupsWithPlugin) {
        await this.screenRepository.update(
          { id: slot.mashupConfiguration.screen.id },
          { cachedPluginOutput: null, renderSignal: null },
        )
      }

      if (mashupsWithPlugin.length > 0) {
        this.logger.log(`Invalidated ${mashupsWithPlugin.length} mashup cache(s) for plugin ${pluginId}`)
      }
    }
    catch (error) {
      const message = getErrorMessage(error)
      this.logger.error(`Failed to invalidate mashup caches for plugin ${pluginId}: ${message}`)
    }
  }
}
