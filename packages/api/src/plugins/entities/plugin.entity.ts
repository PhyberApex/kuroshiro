import type { DevicePlugin } from './device-plugin.entity'
import type { PluginDataSource } from './plugin-data-source.entity'
import type { PluginField } from './plugin-field.entity'
import type { PluginTemplate } from './plugin-template.entity'
import type { PluginVariable } from './plugin-variable.entity'
import { Column, CreateDateColumn, Entity, Index, OneToMany, OneToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'

export const PLUGIN_KINDS = ['Poll', 'Webhook'] as const
export type PluginKind = typeof PLUGIN_KINDS[number]

export const MERGE_STRATEGIES = ['standard', 'deep_merge', 'stream'] as const
export type MergeStrategy = typeof MERGE_STRATEGIES[number]

export type WebhookPayload = Record<string, any> | any[] | null

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

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date

  @OneToMany('DevicePlugin', 'plugin')
  deviceAssignments?: DevicePlugin[]

  @OneToOne('PluginDataSource', 'plugin')
  dataSource?: PluginDataSource

  @OneToMany('PluginTemplate', 'plugin')
  templates: PluginTemplate[]

  @OneToMany('PluginField', 'plugin')
  fields: PluginField[]

  @OneToMany('PluginVariable', 'plugin')
  variables: PluginVariable[]
}
