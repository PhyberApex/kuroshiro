import type { Relation } from 'typeorm'
import type { LogEntry } from '../logs/logs.entity'
import type { Screen } from '../screens/screens.entity'
import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm'
import { DeviceModel } from '../device-models/entities/device-model.entity'
import { Palette } from '../device-models/entities/palette.entity'
import { Firmware } from '../firmware/entities/firmware.entity'

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

  @Column('text', { nullable: true })
  reportedModel?: string | null

  @ManyToOne(() => DeviceModel, { nullable: true, eager: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'deviceModelName' })
  deviceModel?: DeviceModel | null

  @ManyToOne(() => Palette, { nullable: true, eager: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'paletteId' })
  palette?: Palette | null

  @Column('boolean', { nullable: true })
  mirrorEnabled?: boolean

  @Column('text', { nullable: true })
  mirrorMac?: string

  @Column('text', { nullable: true })
  mirrorApikey?: string

  @Column('text', { default: 'identify' })
  specialFunction?: string

  @Column('boolean', { default: false })
  sleepModeEnabled: boolean

  @Column('int', { nullable: true })
  sleepStartTime?: number | null

  @Column('int', { nullable: true })
  sleepEndTime?: number | null

  @Column('boolean', { default: false })
  sleepScreenEnabled: boolean

  @Column('boolean', { default: false })
  resetDevice: boolean

  @Column('boolean', { default: false })
  updateFirmware: boolean

  @ManyToOne(() => Firmware, { nullable: true, eager: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'targetFirmwareId' })
  targetFirmware?: Firmware | null

  @Column('timestamptz', { default: new Date() })
  lastSeen: Date

  @OneToMany('Screen', (screen: Screen) => screen.device)
  screens: Relation<Screen[]>

  @OneToMany('LogEntry', (logEntry: LogEntry) => logEntry.device)
  logs: Relation<LogEntry[]>
}
