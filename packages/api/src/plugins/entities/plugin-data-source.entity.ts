import type { JsonObject } from '../../utils/json'
import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm'
import { Plugin } from './plugin.entity'

export const DATA_SOURCE_MODES = ['fetch', 'literal'] as const
export type DataSourceMode = typeof DATA_SOURCE_MODES[number]

// A plain object, array, or scalar — modeled shallowly (rather than as a fully
// recursive JSON type) because TypeORM's DeepPartial mapping over a
// self-referential union here blows past TS's recursion limit (TS2589).
export type DataSourceLiteralValue = Record<string, unknown> | unknown[] | string | number | boolean | null

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
  headers?: Record<string, string>

  @Column('jsonb', { nullable: true })
  body?: JsonObject

  @Column('text', { nullable: true })
  transformJs?: string | null

  @Column('jsonb', { nullable: true })
  literalValue?: DataSourceLiteralValue

  @Column('int', { default: 0 })
  order: number = 0

  @ManyToOne(() => Plugin, plugin => plugin.dataSources, { onDelete: 'CASCADE' })
  plugin: Plugin
}
