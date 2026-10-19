import type { Repository } from 'typeorm'
import type { JsonObject } from '../../utils/json.js'
import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { In } from 'typeorm'
import { PluginDataSource } from '../entities/plugin-data-source.entity.js'

/**
 * The state a Data Source's transform keeps between runs (ADR-0052): read fresh at the start of a run, since the
 * scheduler's tick holds a snapshot of the Data Sources taken when it was scheduled, and written by the scheduled
 * tick alone, as TRMNL writes it at the end of a run and never from a preview.
 */
@Injectable()
export class PluginDataSourceStateService {
  constructor(
    @InjectRepository(PluginDataSource)
    private readonly dataSourceRepository: Repository<PluginDataSource>,
  ) {}

  /** By Data Source id, for the stored Data Sources that have one. */
  async load(dataSources: Array<{ id?: string, name: string }>): Promise<Record<string, JsonObject>> {
    const ids = dataSources.flatMap(source => source.id ? [source.id] : [])
    if (ids.length === 0)
      return {}
    const rows = await this.dataSourceRepository.find({ where: { id: In(ids) }, select: { id: true, savedState: true } })
    return Object.fromEntries(rows.flatMap(row => row.savedState ? [[row.id, row.savedState]] : []))
  }

  /** `states` by Data Source name, as the run wrote them; a Data Source the run wrote nothing for keeps its state. */
  async save(dataSources: PluginDataSource[], states: Record<string, JsonObject>): Promise<void> {
    for (const source of dataSources) {
      const state = states[source.name]
      if (state)
        await this.dataSourceRepository.update(source.id, { savedState: state as never })
    }
  }
}
