import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm'
import { Device } from '../../devices/devices.entity'

export const DEVICE_SENSOR_KINDS = ['carbon_dioxide', 'humidity', 'pressure', 'temperature'] as const
export type DeviceSensorKind = typeof DEVICE_SENSOR_KINDS[number]

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
