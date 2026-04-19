import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm'
import { Plugin } from './plugin.entity'

@Entity()
export class PluginVariable {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column('text')
  key: string

  @Column('text')
  value: string

  @Column('boolean', { default: false })
  isSecret: boolean

  @ManyToOne(() => Plugin, { onDelete: 'CASCADE' })
  plugin: Plugin
}
