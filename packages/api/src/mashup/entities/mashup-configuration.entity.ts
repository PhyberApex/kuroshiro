import { Column, CreateDateColumn, Entity, JoinColumn, OneToMany, OneToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'
import { Screen } from '../../screens/screens.entity'
import { MashupSlot } from './mashup-slot.entity'

@Entity()
export class MashupConfiguration {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column('text')
  layout: string

  @OneToOne(() => Screen, { onDelete: 'CASCADE' })
  @JoinColumn()
  screen: Screen

  @OneToMany(() => MashupSlot, slot => slot.mashupConfiguration)
  slots: MashupSlot[]

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
