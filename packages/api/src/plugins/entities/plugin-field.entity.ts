import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm'
import { Plugin } from './plugin.entity.js'

export interface PluginFieldOption {
  label: string
  value: string
}

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

  @Column('int', { default: 0 })
  order: number = 0

  @ManyToOne(() => Plugin, plugin => plugin.fields, { onDelete: 'CASCADE' })
  plugin: Plugin
}
