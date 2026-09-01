import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm'
import { Device } from '../../devices/devices.entity.js'
import { Plugin } from './plugin.entity.js'

@Entity()
export class DevicePlugin {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column('boolean', { default: true })
  isActive: boolean

  @Column('int', { default: 0 })
  order: number

  @ManyToOne(() => Device, { onDelete: 'CASCADE' })
  device: Device

  @ManyToOne(() => Plugin, plugin => plugin.deviceAssignments, { onDelete: 'CASCADE' })
  plugin: Plugin
}
