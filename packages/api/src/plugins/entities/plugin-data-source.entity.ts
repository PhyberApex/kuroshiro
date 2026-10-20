import type { DataSourceLiteralValue, DataSourceMode } from 'kuroshiro-shared'
import type { JsonObject } from '../../utils/json.js'
import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm'
import { Plugin } from './plugin.entity.js'

@Entity()
export class PluginDataSource {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column('text')
  name: string

  @Column('text', { default: 'fetch' })
  mode: DataSourceMode = 'fetch'

  @Column('text', { default: 'GET' })
  method: string = 'GET'

  @Column('text', { nullable: true })
  url?: string | null

  @Column('jsonb', { nullable: true })
  headers?: Record<string, string> | null

  @Column('jsonb', { nullable: true })
  body?: JsonObject | null

  @Column('text', { nullable: true })
  transformJs?: string | null

  @Column('jsonb', { nullable: true })
  literalValue?: DataSourceLiteralValue

  /** What its transform returned as `trmnl_state` on the last scheduled run (ADR-0052). */
  @Column('jsonb', { nullable: true })
  savedState?: JsonObject | null

  /** What its transform returned on the last scheduled run, read back as `trmnl.previous_merge_variables` (ADR-0067). */
  @Column('jsonb', { nullable: true })
  previousMergeVariables?: JsonObject | null

  @Column('int', { default: 0 })
  order: number = 0

  // Fetch Failure Streak (ADR-0025): written only by the scheduler tick, for
  // `fetch`-mode sources only. Runtime state — excluded from `.trmnlp`
  // export and the Configuration Archive, like every other runtime value.
  @Column('int', { default: 0 })
  fetchFailureStreak: number = 0

  @Column('timestamptz', { nullable: true })
  lastFetchAttemptAt?: Date | null

  @Column('timestamptz', { nullable: true })
  lastFetchSucceededAt?: Date | null

  @Column('text', { nullable: true })
  lastFetchError?: string | null

  @ManyToOne(() => Plugin, plugin => plugin.dataSources, { onDelete: 'CASCADE' })
  plugin: Plugin
}
