import { Column, Entity, PrimaryColumn } from 'typeorm'

@Entity()
export class DeviceModel {
  @PrimaryColumn('text')
  name: string

  @Column('text')
  label: string

  @Column('text', { nullable: true })
  description?: string | null

  @Column('int')
  width: number

  @Column('int')
  height: number

  @Column('int')
  colors: number

  @Column('int')
  bitDepth: number

  @Column('float')
  scaleFactor: number

  @Column('int', { default: 0 })
  rotation: number

  @Column('int', { default: 0 })
  offsetX: number

  @Column('int', { default: 0 })
  offsetY: number

  @Column('text', { default: 'image/png' })
  mimeType: string

  @Column('text')
  kind: string

  @Column('text', { array: true, default: '{}' })
  paletteIds: string[]

  @Column('text', { array: true, default: '{}' })
  cssClasses: string[]

  @Column('jsonb', { default: {} })
  cssVariables: Record<string, string>

  @Column('int', { nullable: true })
  imageSizeLimit?: number | null

  @Column('boolean', { default: false })
  deprecated: boolean

  @Column('timestamptz', { nullable: true })
  syncedAt?: Date | null
}
