import type { Repository } from 'typeorm'
import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { PluginDataSource } from '../entities/plugin-data-source.entity.js'

function isErrorMarker(value: unknown): value is { error: true, message: string } {
  return typeof value === 'object' && value !== null && (value as { error?: unknown }).error === true
}

/**
 * Records each `fetch`-mode Data Source's outcome from one scheduler tick's
 * resolved data — the sole writer of the Fetch Failure Streak columns
 * (ADR-0025). `literal`-mode sources are never touched, and this must be
 * called only from the scheduler tick: the editor preview, Mashup slot
 * renders and on-demand Device renders all share the same resolver but must
 * not move the streak.
 */
@Injectable()
export class DataSourceFetchOutcomeService {
  constructor(
    @InjectRepository(PluginDataSource)
    private readonly dataSourceRepository: Repository<PluginDataSource>,
  ) {}

  /**
   * `dataSources` comes from the scheduler's cron closure, captured once at
   * schedule time (`PluginSchedulerService.schedulePlugin`) — every later
   * tick reuses that same in-memory snapshot, so `source.fetchFailureStreak`
   * is stale from the second tick onward. The failure branch therefore must
   * not compute `source.fetchFailureStreak + 1` in application code; it
   * increments the persisted column atomically at the database, which is
   * correct regardless of what the stale in-memory copy says and immune to
   * two overlapping ticks racing each other.
   */
  async recordOutcomes(dataSources: PluginDataSource[], resolved: Record<string, unknown>): Promise<void> {
    const now = new Date()
    for (const source of dataSources) {
      if (source.mode !== 'fetch')
        continue

      const value = resolved[source.name]
      if (isErrorMarker(value)) {
        await this.dataSourceRepository.increment({ id: source.id }, 'fetchFailureStreak', 1)
        await this.dataSourceRepository.update(source.id, { lastFetchAttemptAt: now, lastFetchError: value.message })
      }
      else {
        await this.dataSourceRepository.update(source.id, { fetchFailureStreak: 0, lastFetchAttemptAt: now, lastFetchError: null })
      }
    }
  }
}
