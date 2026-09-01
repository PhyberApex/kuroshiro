import type { Relation } from 'typeorm'
import type { Device } from '../devices/devices.entity.js'
import type { MashupConfiguration } from '../mashup/entities/mashup-configuration.entity.js'
import type { Plugin } from '../plugins/entities/plugin.entity.js'
import type { Schedule } from '../schedule/schedule.entity.js'
import { Column, Entity, ManyToOne, OneToOne, PrimaryGeneratedColumn } from 'typeorm'

@Entity()
export class Screen {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'text', default: 'file' })
  type: 'file' | 'external' | 'html' | 'plugin' | 'mashup'

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

  @Column({ type: 'text', nullable: true })
  cachedPluginOutput?: string | null

  @ManyToOne('Device', { onDelete: 'CASCADE' })
  device: Relation<Device>

  @ManyToOne('Plugin', { onDelete: 'CASCADE', nullable: true })
  plugin?: Relation<Plugin>

  @Column({ type: 'uuid', nullable: true })
  devicePluginId?: string | null

  @OneToOne('MashupConfiguration', (mashupConfig: MashupConfiguration) => mashupConfig.screen, { nullable: true })
  mashupConfiguration?: Relation<MashupConfiguration>

  @OneToOne('Schedule', (schedule: Schedule) => schedule.screen, { nullable: true })
  schedule?: Relation<Schedule> | null
}
