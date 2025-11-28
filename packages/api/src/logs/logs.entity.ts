import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm'
import { Device } from '../devices/devices.entity'

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

  @ManyToOne(() => Device, { onDelete: 'CASCADE' })
  device: Device
}
