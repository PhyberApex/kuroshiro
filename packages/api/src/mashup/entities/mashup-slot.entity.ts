import type { Relation } from 'typeorm'
import type { MashupConfiguration } from './mashup-configuration.entity'
import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm'
import { Plugin } from '../../plugins/entities/plugin.entity'

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
}
