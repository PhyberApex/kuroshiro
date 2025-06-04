import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm'
import { Device } from '../devices/devices.entity'

@Entity()
export class Screen {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'text', nullable: true })
  filename?: string | null

  @Column({ type: 'text', nullable: true })
  externalLink?: string | null

  @Column({ type: 'text', nullable: true })
  html?: string | null

  @Column({ type: 'boolean', default: false })
  fetchManual: boolean

  @Column({ type: 'boolean', default: false })
  isActive: boolean

  @Column({ type: 'int' })
  order: number

  @Column({ type: 'timestamptz' })
  generatedAt: Date

  @ManyToOne(() => Device, { onDelete: 'CASCADE' })
  device: Device
}
