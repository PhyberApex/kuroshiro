import type { MergeStrategy, PluginKind, TemplateSize } from 'kuroshiro-shared'
import type { DevicePlugin } from './device-plugin.entity.js'
import type { PluginDataSource } from './plugin-data-source.entity.js'
import type { PluginField } from './plugin-field.entity.js'
import type { PluginTemplate } from './plugin-template.entity.js'
import { Column, CreateDateColumn, Entity, Index, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'

// A plain object, array, or null — modeled shallowly (rather than as a fully
// recursive JSON type) because TypeORM's DeepPartial mapping over a
// self-referential union here blows past TS's recursion limit (TS2589).
export type WebhookPayload = Record<string, unknown> | unknown[] | null

// The Recipe importer's ParsedPlugin output, modeled shallowly like
// WebhookPayload above for the same DeepPartial recursion reason — its Data
// Sources carry a recursive JsonValue-typed body/literalValue.
export type RecipeSnapshot = Record<string, unknown> | null

@Entity()
export class Plugin {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column('text')
  name: string

  @Column('text', { nullable: true })
  description?: string | null

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

  @Column('timestamptz', { nullable: true })
  payloadReceivedAt?: Date | null

  // Inert: the id of the TRMNL Recipe this Plugin was imported from, if any.
  // Nothing reads it yet — kept so a future update-check feature (#794-adjacent)
  // doesn't need a backfill migration (ADR-0011).
  @Column('text', { nullable: true })
  sourceRecipeId?: string

  // The Recipe importer's parsed output at import time — the base a future
  // Recipe Update Check (issue #1028, ADR-0030) diffs against. Only Recipe
  // import sets it; a Plugin imported before this column existed has null.
  @Column('jsonb', { nullable: true })
  sourceRecipeSnapshot?: RecipeSnapshot

  @Column('timestamptz', { nullable: true })
  snapshotTakenAt?: Date | null

  /**
   * The last render a scheduler tick made, and what stopped it if it failed.
   * Runtime state, like the Fetch Failure Streak: left out of `.trmnlp` export
   * and the Configuration Archive.
   */
  @Column('timestamptz', { nullable: true })
  lastScheduledRenderAt?: Date | null

  @Column('text', { nullable: true })
  lastScheduledRenderError?: string | null

  @Column('int', { nullable: true })
  lastScheduledRenderErrorLine?: number | null

  @Column('text', { nullable: true })
  lastScheduledRenderErrorSize?: TemplateSize | null

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
}
