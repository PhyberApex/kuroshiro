import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm'
import { Plugin } from './plugin.entity'

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
  description?: string

  @Column('text', { nullable: true })
  defaultValue?: string

  @Column('boolean', { default: false })
  required: boolean = false

  @Column('int', { default: 0 })
  order: number = 0

  @ManyToOne(() => Plugin, plugin => plugin.fields, { onDelete: 'CASCADE' })
  plugin: Plugin
}
