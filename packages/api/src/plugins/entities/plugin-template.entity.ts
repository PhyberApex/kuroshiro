import { Column, Entity, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm'
import { Plugin } from './plugin.entity.js'

@Entity()
@Unique('UQ_plugin_template_plugin_layout', ['plugin', 'layout'])
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
