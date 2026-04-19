import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm'
import { Plugin } from './plugin.entity'

@Entity()
export class PluginTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column('text', { default: 'full' })
  layout: string = 'full'

  @Column('text')
  liquidMarkup: string

  @Column('timestamptz', { nullable: true })
  lastRenderedAt?: Date

  @ManyToOne(() => Plugin, plugin => plugin.templates, { onDelete: 'CASCADE' })
  plugin: Plugin
}
