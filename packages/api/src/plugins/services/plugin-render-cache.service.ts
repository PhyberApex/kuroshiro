import type { MashupSlot } from '../../mashup/entities/mashup-slot.entity'
import type { Plugin } from '../entities/plugin.entity'
import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Screen } from '../../screens/screens.entity'
import { PluginRendererService } from './plugin-renderer.service'

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

  async renderAndCache(plugin: Plugin, data: any): Promise<void> {
    if (!plugin.templates || plugin.templates.length === 0) {
      return
    }

    const rendered = await this.renderer.render(plugin.templates[0].liquidMarkup, data)

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
      this.logger.error(`Failed to invalidate mashup caches for plugin ${pluginId}: ${error.message}`)
    }
  }
}
