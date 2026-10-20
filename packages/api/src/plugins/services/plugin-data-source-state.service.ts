import type { Repository } from 'typeorm'
import type { JsonObject } from '../../utils/json.js'
import type { ResolveOptions } from './plugin-data-resolver.service.js'
import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { In } from 'typeorm'
import { PluginDataSource } from '../entities/plugin-data-source.entity.js'

/** What one run wrote, by Data Source name: each transform's `trmnl_state` and what it returned besides. */
export interface WrittenByRun {
  states: Record<string, JsonObject>
  mergeVariables: Record<string, JsonObject>
}

/**
 * What a Data Source's transform keeps between runs, its Saved State (ADR-0052) and its last output, handed back
 * as `trmnl.previous_merge_variables` (ADR-0067): read fresh at the start of a run, since the
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
  async load(dataSources: Array<{ id?: string, name: string }>): Promise<Required<ResolveOptions>> {
    const ids = dataSources.flatMap(source => source.id ? [source.id] : [])
    if (ids.length === 0)
      return { savedStates: {}, previousMergeVariables: {} }
    const rows = await this.dataSourceRepository.find({ where: { id: In(ids) }, select: { id: true, savedState: true, previousMergeVariables: true } })
    return {
      savedStates: Object.fromEntries(rows.flatMap(row => row.savedState ? [[row.id, row.savedState]] : [])),
      previousMergeVariables: Object.fromEntries(rows.flatMap(row => row.previousMergeVariables ? [[row.id, row.previousMergeVariables]] : [])),
    }
  }

  /** As the run wrote them; a Data Source the run wrote nothing for keeps what it had. */
  async save(dataSources: PluginDataSource[], { states, mergeVariables }: WrittenByRun): Promise<void> {
    for (const source of dataSources) {
      const state = states[source.name]
      const output = mergeVariables[source.name]
      if (state || output)
        await this.dataSourceRepository.update(source.id, { ...(state && { savedState: state as never }), ...(output && { previousMergeVariables: output as never }) })
    }
  }
}
