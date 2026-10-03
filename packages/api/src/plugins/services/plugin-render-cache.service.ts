import type { TemplateProblem, TemplateSize } from 'kuroshiro-shared'
import type { MashupSlot } from '../../mashup/entities/mashup-slot.entity.js'
import type { Plugin } from '../entities/plugin.entity.js'
import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { templateProblemOf } from 'kuroshiro-shared'
import { Repository } from 'typeorm'
import { Screen } from '../../screens/screens.entity.js'
import { getErrorMessage } from '../../utils/getErrorMessage.js'
import { templateOfSize } from '../plugin-templates.js'
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

  /** Renders the `full` Template, the one a Screen on its own shows, into the cache of every Screen of the Plugin. */
  async renderAndCache(plugin: Plugin, data: object | null): Promise<void> {
    const template = templateOfSize(plugin.templates, 'full')
    if (!template) {
      return
    }

    const rendered = await this.renderer.render(template.liquidMarkup, data ?? {}).catch((error) => {
      throw new TemplateRenderError('full', error)
    })

    await this.screenRepository.update(
      { plugin: { id: plugin.id } },
      {
        cachedPluginOutput: rendered,
        generatedAt: new Date(),
      },
    )

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
          { cachedPluginOutput: null },
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
