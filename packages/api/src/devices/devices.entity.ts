import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm'
import { LogEntry } from '../logs/logs.entity'
import { Screen } from '../screens/screens.entity'

@Entity()
export class Device {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column('text')
  name: string

  @Column('text', { unique: true })
  friendlyId: string

  @Column('text', { unique: true })
  mac: string

  @Column('text')
  apikey: string

  @Column('text', { nullable: true })
  batteryVoltage?: string

  @Column('text', { nullable: true })
  fwVersion?: string

  @Column('int', { default: 300 })
  refreshRate: number

  @Column('text', { nullable: true })
  rssi?: string

  @Column('text', { nullable: true })
  userAgent?: string

  @Column('int', { nullable: true })
  width?: number

  @Column('int', { nullable: true })
  height?: number

  @Column('boolean', { nullable: true })
  mirrorEnabled?: boolean

  @Column('text', { nullable: true })
  mirrorMac?: string

  @Column('text', { nullable: true })
  mirrorApikey?: string

  @Column('text', { default: 'identify' })
  specialFunction?: string

  @Column('boolean', { default: false })
  resetDevice: boolean

  @Column('boolean', { default: false })
  updateFirmware: boolean

  @Column('timestamptz', { default: new Date() })
  lastSeen: Date

  @OneToMany(() => Screen, screen => screen.device)
  screens: Screen[]

  @OneToMany(() => LogEntry, logEntry => logEntry.device)
  logs: LogEntry[]
}
