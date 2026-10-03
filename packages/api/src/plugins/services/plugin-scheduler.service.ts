import type { Plugin } from '../entities/plugin.entity.js'
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common'
import { isRenderablePollPlugin } from '../renderable-poll-plugin.js'
import { PluginRefreshService } from './plugin-refresh.service.js'

const MINUTE_MS = 60_000
// A longer delay overflows Node's timer and fires after one millisecond.
const LONGEST_TIMER_DELAY_MS = 2 ** 31 - 1

@Injectable()
export class PluginSchedulerService implements OnModuleDestroy {
  private scheduledJobs: Map<string, NodeJS.Timeout> = new Map()
  private readonly logger = new Logger(PluginSchedulerService.name)

  constructor(private readonly pluginRefresh: PluginRefreshService) {}

  /** Runs the Plugin every `refreshInterval` minutes from now, in place of any job it already has. */
  schedulePlugin(plugin: Plugin): void {
    this.removeScheduledJob(plugin.id)

    if (!isRenderablePollPlugin(plugin)) {
      return
    }

    const delay = Math.min(Math.max(plugin.refreshInterval, 1) * MINUTE_MS, LONGEST_TIMER_DELAY_MS)
    this.scheduledJobs.set(plugin.id, setInterval(() => void this.runTick(plugin), delay))
  }

  /** One scheduler tick, outside the timer. It never rejects: a failed tick is logged. */
  async runTick(plugin: Plugin): Promise<void> {
    try {
      await this.pluginRefresh.refresh(plugin, { scheduled: true })
    }
    catch (error) {
      this.logger.error(`Error executing plugin ${plugin.id}`, error)
    }
  }

  removeScheduledJob(pluginId: string): void {
    const timer = this.scheduledJobs.get(pluginId)
    if (timer) {
      clearInterval(timer)
      this.scheduledJobs.delete(pluginId)
    }
  }

  hasScheduledJob(pluginId: string): boolean {
    return this.scheduledJobs.has(pluginId)
  }

  onModuleDestroy(): void {
    for (const pluginId of [...this.scheduledJobs.keys()])
      this.removeScheduledJob(pluginId)
  }
}
