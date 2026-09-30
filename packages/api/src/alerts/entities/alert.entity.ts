import type { AlertKind } from 'kuroshiro-shared'
import type { Relation } from 'typeorm'
import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm'
import { Device } from '../../devices/devices.entity.js'

@Entity()
export class Alert {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column('text')
  kind: AlertKind

  @ManyToOne(() => Device, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'deviceId' })
  device?: Relation<Device> | null

  @Column('timestamptz')
  openedAt: Date

  @Column('timestamptz', { nullable: true })
  resolvedAt?: Date | null

  @Column('timestamptz', { nullable: true })
  notifiedAt?: Date | null

  @Column('timestamptz', { nullable: true })
  resolutionNotifiedAt?: Date | null

  @Column('jsonb', { nullable: true })
  details?: Record<string, unknown> | null
}
