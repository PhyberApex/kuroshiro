import type { ScheduledTask } from 'node-cron'
import type { Plugin } from '../entities/plugin.entity.js'
import { Injectable, Logger } from '@nestjs/common'
import cron from 'node-cron'
import { PluginRefreshService } from './plugin-refresh.service.js'

@Injectable()
export class PluginSchedulerService {
  private scheduledJobs: Map<string, ScheduledTask> = new Map()
  private readonly logger = new Logger(PluginSchedulerService.name)

  constructor(private readonly pluginRefresh: PluginRefreshService) {}

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
        await this.pluginRefresh.refresh(plugin)
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
