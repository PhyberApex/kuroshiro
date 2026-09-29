import type { DeviceSensorKind } from 'kuroshiro-shared'
import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm'
import { Device } from '../../devices/devices.entity.js'

@Entity()
export class DeviceSensor {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column('text')
  kind: DeviceSensorKind

  @Column('float')
  value: number

  @Column('text')
  unit: string

  @ManyToOne(() => Device, { onDelete: 'CASCADE' })
  device: Device
}
