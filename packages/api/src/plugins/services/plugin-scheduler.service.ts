import type { ScheduledTask } from 'node-cron'
import type { Plugin } from '../entities/plugin.entity'
import { Injectable, Logger } from '@nestjs/common'
import cron from 'node-cron'
import { PluginDataFetcherService } from './plugin-data-fetcher.service'
import { PluginRenderCacheService } from './plugin-render-cache.service'
import { PluginTemplateContextService } from './plugin-template-context.service'

@Injectable()
export class PluginSchedulerService {
  private scheduledJobs: Map<string, ScheduledTask> = new Map()
  private readonly logger = new Logger(PluginSchedulerService.name)

  constructor(
    private readonly dataFetcher: PluginDataFetcherService,
    private readonly renderCache: PluginRenderCacheService,
    private readonly pluginTemplateContext: PluginTemplateContextService,
  ) {}

  schedulePlugin(plugin: Plugin): void {
    if (plugin.kind === 'Webhook') {
      return
    }

    if (!plugin.dataSources || plugin.dataSources.length === 0 || !plugin.templates || plugin.templates.length === 0) {
      return
    }

    const cronExpression = this.getCronExpression(plugin.refreshInterval)

    const task = cron.schedule(cronExpression, async () => {
      try {
        // This cache entry is shared across every Screen/Device the Plugin is
        // assigned to (renderAndCache below writes it to all of them), so
        // there is no single Device to scope sensors to here.
        const templateContext = this.pluginTemplateContext.build(plugin, [])

        // Fetch all of the plugin's data sources in parallel; a source that fails
        // gets an error marker instead of aborting the whole render (ADR-0005).
        // A literal-mode source has no fetch to make — it contributes its
        // stored value directly, with no call to the data fetcher at all.
        const results = await Promise.allSettled(
          plugin.dataSources.map(source => this.dataFetcher.fetchOrLiteral(source, templateContext)),
        )

        const sourceData: Record<string, unknown> = {}
        results.forEach((result, index) => {
          const name = plugin.dataSources[index].name
          if (result.status === 'fulfilled') {
            sourceData[name] = result.value
          }
          else {
            this.logger.warn(`Data source "${name}" failed for plugin ${plugin.id}: ${result.reason?.message || result.reason}`)
            sourceData[name] = { error: true, message: result.reason?.message || String(result.reason) }
          }
        })

        await this.renderCache.renderAndCache(plugin, { ...templateContext, ...sourceData })
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
