import type { Relation } from 'typeorm'
import type { Device } from '../devices/devices.entity.js'
import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm'

@Entity()
export class LogEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'text' })
  entry: string

  @Column({ type: 'timestamptz' })
  date: Date

  @Column({ type: 'int' })
  logId: number

  @ManyToOne('Device', { onDelete: 'CASCADE' })
  device: Relation<Device>
}
