import type { Relation } from 'typeorm'
import type { Screen } from '../../screens/screens.entity.js'
import type { MashupSlot } from './mashup-slot.entity.js'
import { Column, CreateDateColumn, Entity, JoinColumn, OneToMany, OneToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'

@Entity()
export class MashupConfiguration {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column('text')
  layout: string

  @OneToOne('Screen', (screen: Screen) => screen.mashupConfiguration, { onDelete: 'CASCADE' })
  @JoinColumn()
  screen: Relation<Screen>

  @OneToMany('MashupSlot', (slot: MashupSlot) => slot.mashupConfiguration)
  slots: Relation<MashupSlot[]>

  /**
   * Whether each slot's own Render Signal has been read for the Mashup's current cached
   * output. Set once its whole page raised a signal, cleared whenever the cached output is
   * written, so a page that keeps raising one has its slots read once per cache (ADR-0067).
   */
  @Column({ type: 'boolean', default: false })
  slotSignalsRead: boolean

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
