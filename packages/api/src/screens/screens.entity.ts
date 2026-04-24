import type { Plugin } from '../plugins/entities/plugin.entity'
import { Column, Entity, ManyToOne, OneToOne, PrimaryGeneratedColumn } from 'typeorm'
import { Device } from '../devices/devices.entity'
import { MashupConfiguration } from '../mashup/entities/mashup-configuration.entity'

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

  @ManyToOne(() => Device, { onDelete: 'CASCADE' })
  device: Device

  @ManyToOne('Plugin', { onDelete: 'CASCADE', nullable: true })
  plugin?: Plugin

  @Column({ type: 'uuid', nullable: true })
  devicePluginId?: string | null

  @OneToOne(() => MashupConfiguration, mashupConfig => mashupConfig.screen, { nullable: true })
  mashupConfiguration?: MashupConfiguration
}
