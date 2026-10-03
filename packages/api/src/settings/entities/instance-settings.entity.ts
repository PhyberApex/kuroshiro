import { Column, Entity, PrimaryColumn } from 'typeorm'

// A single row keyed by this fixed id (ADR-0027) — the row need not exist until the first save.
export const INSTANCE_SETTINGS_ID = 1

@Entity()
export class InstanceSettings {
  @PrimaryColumn('int')
  id: number

  @Column('int', { nullable: true })
  lowBatteryPercent?: number | null

  @Column('int', { nullable: true })
  offlineMultiplier?: number | null

  @Column('int', { nullable: true })
  fetchFailureThreshold?: number | null

  @Column('int', { nullable: true })
  alertRetentionDays?: number | null

  @Column('int', { nullable: true })
  deviceLogRetentionDays?: number | null

  @Column('boolean', { nullable: true })
  firmwareAutoUpdate?: boolean | null
}
