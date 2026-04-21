import { Column, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn } from 'typeorm'
import { Plugin } from './plugin.entity'

@Entity()
export class PluginDataSource {
  @PrimaryGeneratedColumn('uuid')
  id: string

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

  @OneToOne(() => Plugin, plugin => plugin.dataSource, { onDelete: 'CASCADE' })
  @JoinColumn()
  plugin: Plugin
}
