import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

export type FirmwareKind = 'official-synced' | 'custom'

@Entity()
@Index('UQ_firmware_custom_version', ['version'], { unique: true, where: `"kind" = 'custom'` })
@Index('UQ_firmware_folder_version', ['folder', 'version'], { unique: true, where: `"kind" = 'official-synced'` })
export class Firmware {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column('text')
  version: string

  @Column('text')
  kind: FirmwareKind

  /** The folder of TRMNL's firmware bucket an `official-synced` row came from (ADR-0065); `null` for `custom`. */
  @Column('text', { nullable: true })
  folder?: string | null

  @Column('text')
  checksum: string

  @Column('text', { array: true, default: '{}' })
  compatibleModels: string[]

  @Column('boolean', { default: false })
  deprecated: boolean

  @Column('text', { nullable: true })
  label?: string | null

  @Column('timestamptz', { nullable: true })
  syncedAt?: Date | null

  @Column('timestamptz', { nullable: true })
  uploadedAt?: Date | null
}
