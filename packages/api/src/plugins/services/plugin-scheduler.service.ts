import type { Plugin } from '../entities/plugin.entity.js'
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common'
import { isRenderablePollPlugin } from '../renderable-poll-plugin.js'
import { PluginRefreshService } from './plugin-refresh.service.js'

const MINUTE_MS = 60_000
// A longer delay overflows Node's timer and fires after one millisecond.
const LONGEST_TIMER_DELAY_MS = 2 ** 31 - 1
// A long downtime leaves every Plugin due; this bounds how long their boot ticks spread over.
const MAX_SPREAD_WINDOW_MS = 5 * MINUTE_MS

/**
 * The most recent fetch attempt behind a Plugin's render: its own last scheduled render, or a
 * Data Source's last fetch attempt where that is later (a tick that threw before recording the
 * render still moved a Data Source's streak, ADR-0025). `null` if the Plugin was never attempted.
 */
function lastAttemptAt(plugin: Plugin): Date | null {
  const attempts = [plugin.lastScheduledRenderAt, ...(plugin.dataSources ?? []).map(source => source.lastFetchAttemptAt)]
    .filter((at): at is Date => at != null)

  return attempts.length > 0 ? new Date(Math.max(...attempts.map(at => at.getTime()))) : null
}

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

    const interval = this.intervalMsFor(plugin)
    this.scheduledJobs.set(plugin.id, setInterval(() => void this.runTick(plugin), interval))
  }

  /**
   * Schedules a Plugin the way `schedulePlugin` does, but for use at boot: a Plugin whose last
   * attempt is within its refresh interval skips the boot tick, with its first tick landing at
   * the interval's remainder since that attempt, so the cadence survives a restart. A due Plugin
   * (never attempted, or attempted longer ago than its interval) ticks once after a random delay
   * inside a short window, so many due Plugins after a long downtime do not all fetch at once.
   */
  scheduleAtBoot(plugin: Plugin, now: Date = new Date()): void {
    this.removeScheduledJob(plugin.id)

    if (!isRenderablePollPlugin(plugin)) {
      return
    }

    const interval = this.intervalMsFor(plugin)
    const attempt = lastAttemptAt(plugin)
    const elapsedMs = attempt ? now.getTime() - attempt.getTime() : null
    const firstTickDelayMs = elapsedMs !== null && elapsedMs < interval
      ? interval - elapsedMs
      : Math.floor(Math.random() * (Math.min(interval, MAX_SPREAD_WINDOW_MS) + 1))

    const timer = setTimeout(() => {
      void this.runTick(plugin)
      this.scheduledJobs.set(plugin.id, setInterval(() => void this.runTick(plugin), interval))
    }, Math.min(firstTickDelayMs, LONGEST_TIMER_DELAY_MS))
    this.scheduledJobs.set(plugin.id, timer)
  }

  private intervalMsFor(plugin: Plugin): number {
    return Math.min(Math.max(plugin.refreshInterval, 1) * MINUTE_MS, LONGEST_TIMER_DELAY_MS)
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
