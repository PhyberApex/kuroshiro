import type { SyncKind } from 'kuroshiro-shared'
import { Column, Entity, PrimaryColumn } from 'typeorm'

/** The last sync with TRMNL of one kind: one row per kind, overwritten by every sync. */
@Entity()
export class SyncRun {
  @PrimaryColumn('text')
  kind: SyncKind

  @Column('timestamptz')
  ranAt: Date

  @Column('boolean')
  ok: boolean

  @Column('text', { nullable: true })
  error: string | null
}
