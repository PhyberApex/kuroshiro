import type { ScheduledTask } from 'node-cron'
import type { Plugin } from '../entities/plugin.entity.js'
import { Injectable, Logger } from '@nestjs/common'
import cron from 'node-cron'
import { PluginDataResolverService } from './plugin-data-resolver.service.js'
import { PluginRenderCacheService } from './plugin-render-cache.service.js'
import { PluginTemplateContextService } from './plugin-template-context.service.js'

@Injectable()
export class PluginSchedulerService {
  private scheduledJobs: Map<string, ScheduledTask> = new Map()
  private readonly logger = new Logger(PluginSchedulerService.name)

  constructor(
    private readonly pluginDataResolver: PluginDataResolverService,
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

        const sourceData = await this.pluginDataResolver.resolveAll(plugin.dataSources, templateContext)

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
