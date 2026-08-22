import { Column, Entity, PrimaryColumn } from 'typeorm'

export const PALETTE_KINDS = ['official', 'custom'] as const
export type PaletteKind = typeof PALETTE_KINDS[number]

export const CUSTOM_PALETTE_FRAMEWORK_CLASSES = [
  'screen--color-3bwr',
  'screen--color-3bwy',
  'screen--color-4bwry',
  'screen--color-6a',
  'screen--color-7a',
] as const
export type CustomPaletteFrameworkClass = typeof CUSTOM_PALETTE_FRAMEWORK_CLASSES[number]

@Entity()
export class Palette {
  @PrimaryColumn('text')
  id: string

  @Column('text')
  name: string

  @Column('text', { default: 'official' })
  kind: PaletteKind = 'official'

  @Column('int')
  grays: number

  @Column('text', { array: true, nullable: true })
  colors?: string[] | null

  @Column('text')
  frameworkClass: string

  @Column('int', { nullable: true })
  grayscaleBitDepth?: number | null

  @Column('boolean', { default: false })
  deprecated: boolean

  @Column('timestamptz', { nullable: true })
  syncedAt?: Date | null
}
