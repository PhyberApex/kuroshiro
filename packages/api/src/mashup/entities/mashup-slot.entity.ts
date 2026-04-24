import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm'
import { Plugin } from '../../plugins/entities/plugin.entity'
import { MashupConfiguration } from './mashup-configuration.entity'

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

  @ManyToOne(() => MashupConfiguration, config => config.slots, { onDelete: 'CASCADE' })
  mashupConfiguration: MashupConfiguration

  @Column('int')
  order: number
}
