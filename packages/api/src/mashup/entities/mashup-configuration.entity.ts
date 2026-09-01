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

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
