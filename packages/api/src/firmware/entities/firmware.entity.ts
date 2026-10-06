import { Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm'

export type FirmwareKind = 'official-synced' | 'custom'

@Entity()
@Unique('UQ_firmware_version', ['version'])
export class Firmware {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column('text')
  version: string

  @Column('text')
  kind: FirmwareKind

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
