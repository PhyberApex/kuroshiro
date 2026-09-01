import type { DevicePlugin } from './device-plugin.entity.js'
import type { PluginDataSource } from './plugin-data-source.entity.js'
import type { PluginField } from './plugin-field.entity.js'
import type { PluginTemplate } from './plugin-template.entity.js'
import type { PluginVariable } from './plugin-variable.entity.js'
import { Column, CreateDateColumn, Entity, Index, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'

export const PLUGIN_KINDS = ['Poll', 'Webhook'] as const
export type PluginKind = typeof PLUGIN_KINDS[number]

export const MERGE_STRATEGIES = ['standard', 'deep_merge', 'stream'] as const
export type MergeStrategy = typeof MERGE_STRATEGIES[number]

// A plain object, array, or null — modeled shallowly (rather than as a fully
// recursive JSON type) because TypeORM's DeepPartial mapping over a
// self-referential union here blows past TS's recursion limit (TS2589).
export type WebhookPayload = Record<string, unknown> | unknown[] | null

@Entity()
export class Plugin {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column('text')
  name: string

  @Column('text', { nullable: true })
  description?: string

  @Column('text', { default: 'Poll' })
  kind: PluginKind = 'Poll'

  @Column('int', { default: 15 })
  refreshInterval: number = 15

  @Index({ unique: true })
  @Column('text', { nullable: true })
  webhookToken?: string | null

  @Column('text', { nullable: true })
  mergeStrategy?: MergeStrategy | null

  @Column('int', { nullable: true })
  streamLimit?: number | null

  @Column('jsonb', { nullable: true })
  webhookPayload?: WebhookPayload

  // Inert: the id of the TRMNL Recipe this Plugin was imported from, if any.
  // Nothing reads it yet — kept so a future update-check feature (#794-adjacent)
  // doesn't need a backfill migration (ADR-0011).
  @Column('text', { nullable: true })
  sourceRecipeId?: string

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date

  @OneToMany('DevicePlugin', 'plugin')
  deviceAssignments?: DevicePlugin[]

  @OneToMany('PluginDataSource', 'plugin')
  dataSources: PluginDataSource[]

  @OneToMany('PluginTemplate', 'plugin')
  templates: PluginTemplate[]

  @OneToMany('PluginField', 'plugin')
  fields: PluginField[]

  @OneToMany('PluginVariable', 'plugin')
  variables: PluginVariable[]
}

export type DevicePluginView = Plugin & {
  _devicePluginId: string
  _isActive: boolean
  _order: number
}
