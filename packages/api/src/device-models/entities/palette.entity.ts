import { Column, Entity, PrimaryColumn } from 'typeorm'

@Entity()
export class Palette {
  @PrimaryColumn('text')
  id: string

  @Column('text')
  name: string

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
