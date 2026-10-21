import type { RenderSignal } from 'kuroshiro-shared'
import type { Relation } from 'typeorm'
import type { MashupConfiguration } from './mashup-configuration.entity.js'
import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm'
import { Plugin } from '../../plugins/entities/plugin.entity.js'

@Entity()
export class MashupSlot {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column('text')
  position: string

  @Column('text')
  size: string

  @ManyToOne(() => Plugin, { onDelete: 'CASCADE' })
  plugin: Plugin

  @ManyToOne('MashupConfiguration', (config: MashupConfiguration) => config.slots, { onDelete: 'CASCADE' })
  mashupConfiguration: Relation<MashupConfiguration>

  @Column('int')
  order: number

  /**
   * The slot's own markup in its Mashup's cached output, `null` when its Plugin could not be
   * rendered. Written whenever that cached output is, so it is runtime state like it.
   */
  @Column({ type: 'text', nullable: true })
  renderedMarkup?: string | null

  /**
   * The markup the slot last drew live, raising no Render Signal: what a `hold` on the slot
   * draws again (ADR-0067). Kept across cached output changes, lost when the Mashup's slots
   * are rebuilt by an edit.
   */
  @Column({ type: 'text', nullable: true })
  liveMarkup?: string | null

  /**
   * The Render Signal the slot's `renderedMarkup` raised on its own page, read only once the
   * Mashup's whole page raised one; cleared whenever the cached output is written (ADR-0067).
   */
  @Column({ type: 'text', nullable: true })
  renderSignal?: RenderSignal | null
}
