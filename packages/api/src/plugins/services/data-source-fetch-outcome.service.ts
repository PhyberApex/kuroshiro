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

  async recordOutcomes(dataSources: PluginDataSource[], resolved: Record<string, unknown>): Promise<void> {
    const now = new Date()
    for (const source of dataSources) {
      if (source.mode !== 'fetch')
        continue

      const value = resolved[source.name]
      const fields = isErrorMarker(value)
        ? { fetchFailureStreak: source.fetchFailureStreak + 1, lastFetchAttemptAt: now, lastFetchError: value.message }
        : { fetchFailureStreak: 0, lastFetchAttemptAt: now, lastFetchError: null }

      await this.dataSourceRepository.update(source.id, fields)
    }
  }
}
