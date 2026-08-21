import type { ScheduledTask } from 'node-cron'
import type { Plugin } from '../entities/plugin.entity'
import { Injectable, Logger } from '@nestjs/common'
import cron from 'node-cron'
import { PluginDataFetcherService } from './plugin-data-fetcher.service'
import { PluginRenderCacheService } from './plugin-render-cache.service'

@Injectable()
export class PluginSchedulerService {
  private scheduledJobs: Map<string, ScheduledTask> = new Map()
  private readonly logger = new Logger(PluginSchedulerService.name)

  constructor(
    private readonly dataFetcher: PluginDataFetcherService,
    private readonly renderCache: PluginRenderCacheService,
  ) {}

  schedulePlugin(plugin: Plugin): void {
    if (plugin.kind === 'Webhook') {
      return
    }

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

        await this.renderCache.renderAndCache(plugin, data)
      }
      catch (error) {
        this.logger.error(`Error executing plugin ${plugin.id}`, error)
      }
    })

    this.scheduledJobs.set(plugin.id, task)
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
