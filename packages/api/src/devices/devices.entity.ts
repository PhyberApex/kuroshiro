import type { Relation } from 'typeorm'
import type { LogEntry } from '../logs/logs.entity.js'
import type { Screen } from '../screens/screens.entity.js'
import type { LastServedFallback, LastServedKind, LastServedReason } from './last-served.js'
import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm'
import { DeviceModel } from '../device-models/entities/device-model.entity.js'
import { Palette } from '../device-models/entities/palette.entity.js'
import { Firmware } from '../firmware/entities/firmware.entity.js'

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

  /**
   * When the Device's own sleep image was last stored or reconverted; `null`
   * while it has none. Bumped on both, so it also serves as the image's
   * cache-busting version and the `filename` a poll is given.
   */
  @Column('timestamptz', { nullable: true })
  sleepImageGeneratedAt?: Date | null

  @Column('boolean', { default: false })
  resetDevice: boolean

  /** Rides on `resetDevice` (ADR-0039): rotates `apikey` in the same poll that delivers the Reset, then clears with it. */
  @Column('boolean', { default: false })
  resetDeviceNewApikey: boolean

  @Column('boolean', { default: false })
  updateFirmware: boolean

  @ManyToOne(() => Firmware, { nullable: true, eager: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'targetFirmwareId' })
  targetFirmware?: Firmware | null

  /** The Screen an admin picked ("Show next"), served and cleared by the next non-sleeping `/display` poll (ADR-0038). */
  @ManyToOne('Screen', { nullable: true, eager: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'pickedScreenId' })
  pickedScreen?: Relation<Screen> | null

  /** `null` until the Device's first `/display` poll. */
  @Column('timestamptz', { nullable: true })
  lastSeen?: Date | null

  /** The raw `Update-Source` header of the last poll that sent one; `null` when it sent none. */
  @Column('text', { nullable: true })
  lastWakeSource?: string | null

  @Column('timestamptz', { nullable: true })
  lastServedAt?: Date | null

  @Column('text', { nullable: true })
  lastServedKind?: LastServedKind | null

  /** The Screen served, or the one that could not be rendered when the error Fallback Screen was served for it. */
  @Column('uuid', { nullable: true })
  lastServedScreenId?: string | null

  @Column('text', { nullable: true })
  lastServedFallback?: LastServedFallback | null

  @Column('text', { nullable: true })
  lastServedReason?: LastServedReason | null

  @Column('int', { nullable: true })
  lastServedRefreshRate?: number | null

  @Column('text', { nullable: true })
  lastServedImagePath?: string | null

  @OneToMany('Screen', (screen: Screen) => screen.device)
  screens: Relation<Screen[]>

  @OneToMany('LogEntry', (logEntry: LogEntry) => logEntry.device)
  logs: Relation<LogEntry[]>
}
