import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm'
import { Device } from '../../devices/devices.entity'
import { PluginField } from './plugin-field.entity'
import { Plugin } from './plugin.entity'

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
