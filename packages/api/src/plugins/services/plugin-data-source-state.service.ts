import type { Repository } from 'typeorm'
import type { JsonObject } from '../../utils/json.js'
import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { In } from 'typeorm'
import { PluginDataSource } from '../entities/plugin-data-source.entity.js'

/** What a run starts from, by Data Source id. */
export interface StoredBetweenRuns {
  savedStates: Record<string, JsonObject>
  previousOutputs: Record<string, JsonObject>
}

/** What one run wrote, by Data Source name: each transform's `trmnl_state` and its output. */
export interface WrittenByRun {
  states: Record<string, JsonObject>
  previousOutputs: Record<string, JsonObject>
}

/**
 * What a Data Source's transform keeps between runs, its Saved State (ADR-0052) and its Previous Output, handed back
 * as `trmnl.previous_merge_variables` (ADR-0070): read fresh at the start of a run, since the
 * scheduler's tick holds a snapshot of the Data Sources taken when it was scheduled, and written by the scheduled
 * tick alone, as TRMNL writes it at the end of a run and never from a preview.
 */
@Injectable()
export class PluginDataSourceStateService {
  constructor(
    @InjectRepository(PluginDataSource)
    private readonly dataSourceRepository: Repository<PluginDataSource>,
  ) {}

  /** By Data Source id, for the stored Data Sources that have them. */
  async load(dataSources: Array<{ id?: string, name: string }>): Promise<StoredBetweenRuns> {
    const ids = dataSources.flatMap(source => source.id ? [source.id] : [])
    if (ids.length === 0)
      return { savedStates: {}, previousOutputs: {} }
    const rows = await this.dataSourceRepository.find({ where: { id: In(ids) }, select: { id: true, savedState: true, previousOutput: true } })
    return {
      savedStates: Object.fromEntries(rows.flatMap(row => row.savedState ? [[row.id, row.savedState]] : [])),
      previousOutputs: Object.fromEntries(rows.flatMap(row => row.previousOutput ? [[row.id, row.previousOutput]] : [])),
    }
  }

  /** As the run wrote them; a Data Source the run wrote nothing for keeps what it had. */
  async save(dataSources: PluginDataSource[], { states, previousOutputs }: WrittenByRun): Promise<void> {
    for (const source of dataSources) {
      const state = states[source.name]
      const output = previousOutputs[source.name]
      if (state || output)
        await this.dataSourceRepository.update(source.id, { ...(state && { savedState: state as never }), ...(output && { previousOutput: output as never }) })
    }
  }
}
