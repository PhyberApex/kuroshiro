import type { Repository } from 'typeorm'
import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { PluginDataSource } from '../entities/plugin-data-source.entity.js'
import { isFetchErrorMarker } from './plugin-data-resolver.service.js'

const LINE_INDEX = /^IDX_\d+$/

/**
 * Why a fetch-mode Data Source's value is a failed fetch, or `null` when it is
 * not one. A multi-line URL resolves to `{ IDX_0: …, IDX_1: … }` with a failed
 * line's error marker under its index (ADR-0058), so a line failing is a failed
 * fetch too, named by its index: the Template reads that line's marker in place
 * of its data just as it would a lone line's.
 */
function fetchErrorOf(value: unknown): string | null {
  if (isFetchErrorMarker(value))
    return value.message
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    return null
  const lines = Object.entries(value)
  if (lines.length === 0 || !lines.every(([key]) => LINE_INDEX.test(key)))
    return null
  const failed = lines.flatMap(([key, line]) => isFetchErrorMarker(line) ? [`${key}: ${line.message}`] : [])
  return failed.length > 0 ? failed.join('\n') : null
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
   * `dataSources` comes from the scheduler's timer closure, captured once at
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

      const fetchError = fetchErrorOf(resolved[source.name])
      if (fetchError !== null) {
        await this.dataSourceRepository.increment({ id: source.id }, 'fetchFailureStreak', 1)
        await this.dataSourceRepository.update(source.id, { lastFetchAttemptAt: now, lastFetchError: fetchError })
      }
      else {
        await this.dataSourceRepository.update(source.id, { fetchFailureStreak: 0, lastFetchAttemptAt: now, lastFetchSucceededAt: now, lastFetchError: null })
      }
    }
  }
}
