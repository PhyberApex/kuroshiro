import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm'
import { Plugin } from './plugin.entity'

@Entity()
export class PluginDataSource {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column('text')
  name: string

  @Column('text', { default: 'GET' })
  method: string = 'GET'

  @Column('text')
  url: string

  @Column('jsonb', { nullable: true })
  headers?: Record<string, string>

  @Column('jsonb', { nullable: true })
  body?: Record<string, any>

  @Column('text', { nullable: true })
  transformJs?: string

  @Column('int', { default: 0 })
  order: number = 0

  @ManyToOne(() => Plugin, plugin => plugin.dataSources, { onDelete: 'CASCADE' })
  plugin: Plugin
}
