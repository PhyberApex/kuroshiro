import type { DataSourceLiteralValue, DataSourceMode } from 'kuroshiro-shared'
import type { JsonObject } from '../../utils/json'
import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm'
import { Plugin } from './plugin.entity'

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
