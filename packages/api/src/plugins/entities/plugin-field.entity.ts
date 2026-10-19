import type { PluginFieldAttributes, PluginFieldOption } from 'kuroshiro-shared'
import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm'
import { Plugin } from './plugin.entity.js'

@Entity()
export class PluginField {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column('text')
  keyname: string

  @Column('text', { default: 'string' })
  fieldType: string = 'string'

  @Column('text')
  name: string

  @Column('text', { nullable: true })
  description?: string | null

  @Column('text', { nullable: true })
  defaultValue?: string | null

  @Column('jsonb', { nullable: true })
  options?: PluginFieldOption[] | null

  @Column('boolean', { default: false })
  required: boolean = false

  /** What the Plugin Field carries beyond its type: placeholder, hint, group, bounds (ADR-0053). */
  @Column('jsonb', { default: {} })
  attributes: PluginFieldAttributes = {}

  @Column('int', { default: 0 })
  order: number = 0

  @ManyToOne(() => Plugin, plugin => plugin.fields, { onDelete: 'CASCADE' })
  plugin: Plugin
}
