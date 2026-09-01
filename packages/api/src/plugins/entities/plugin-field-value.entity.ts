import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm'
import { Device } from '../../devices/devices.entity.js'
import { PluginField } from './plugin-field.entity.js'
import { Plugin } from './plugin.entity.js'

@Entity()
export class PluginFieldValue {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column('text')
  value: string

  @ManyToOne(() => Plugin, { onDelete: 'CASCADE' })
  plugin: Plugin

  @ManyToOne(() => PluginField, { onDelete: 'CASCADE' })
  field: PluginField

  @ManyToOne(() => Device, { onDelete: 'CASCADE', nullable: true })
  device?: Device
}
