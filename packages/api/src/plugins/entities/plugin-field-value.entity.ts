import { Column, Entity, JoinColumn, ManyToOne, OneToOne, PrimaryGeneratedColumn } from 'typeorm'
import { PluginField } from './plugin-field.entity.js'
import { Plugin } from './plugin.entity.js'

@Entity()
export class PluginFieldValue {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column('text')
  value: string

  @ManyToOne(() => Plugin, { onDelete: 'CASCADE', nullable: false })
  plugin: Plugin

  @OneToOne(() => PluginField, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn()
  field: PluginField
}
