import type { ScheduledTask } from 'node-cron'
import type { MashupSlot } from '../../mashup/entities/mashup-slot.entity'
import type { Plugin } from '../entities/plugin.entity'
import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import cron from 'node-cron'
import { Repository } from 'typeorm'
import { Screen } from '../../screens/screens.entity'
import { PluginDataFetcherService } from './plugin-data-fetcher.service'
import { PluginRendererService } from './plugin-renderer.service'

@Injectable()
export class PluginSchedulerService {
  private scheduledJobs: Map<string, ScheduledTask> = new Map()
  private mashupSlotRepository: Repository<MashupSlot>
  private readonly logger = new Logger(PluginSchedulerService.name)

  constructor(
    private readonly dataFetcher: PluginDataFetcherService,
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

  schedulePlugin(plugin: Plugin): void {
    if (!plugin.dataSource || !plugin.templates || plugin.templates.length === 0) {
      return
    }

    const cronExpression = this.getCronExpression(plugin.refreshInterval)

    const task = cron.schedule(cronExpression, async () => {
      try {
        // Build template context with trmnl system variables
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

        // TODO: Add plugin field values to context when we have device-specific values

        const data = await this.dataFetcher.fetchData(
          plugin.dataSource.method,
          plugin.dataSource.url,
          plugin.dataSource.headers,
          plugin.dataSource.body,
          templateContext,
        )

        // Render primary template and cache to all associated screens
        if (plugin.templates.length > 0) {
          const rendered = await this.renderer.render(plugin.templates[0].liquidMarkup, data)

          // Update all screens for this plugin
          await this.screenRepository.update(
            { plugin: { id: plugin.id } },
            {
              cachedPluginOutput: rendered,
              generatedAt: new Date(),
            },
          )

          // Invalidate mashup caches that use this plugin
          await this.invalidateMashupCaches(plugin.id)
        }
      }
      catch (error) {
        console.error(`Error executing plugin ${plugin.id}:`, error)
      }
    })

    this.scheduledJobs.set(plugin.id, task)
  }

  async invalidateMashupCaches(pluginId: string): Promise<void> {
    if (!this.mashupSlotRepository) {
      return
    }

    try {
      const mashupsWithPlugin = await this.mashupSlotRepository.find({
        where: { plugin: { id: pluginId } },
        relations: ['mashupConfiguration', 'mashupConfiguration.screen'],
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

  removeScheduledJob(pluginId: string): void {
    const task = this.scheduledJobs.get(pluginId)
    if (task) {
      task.stop()
      this.scheduledJobs.delete(pluginId)
    }
  }

  hasScheduledJob(pluginId: string): boolean {
    return this.scheduledJobs.has(pluginId)
  }

  private getCronExpression(minutes: number): string {
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60)
      return hours === 1 ? '0 * * * *' : `0 */${hours} * * *`
    }
    return `*/${minutes} * * * *`
  }
}
