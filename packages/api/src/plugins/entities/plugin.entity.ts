import type { DevicePlugin } from './device-plugin.entity'
import type { PluginDataSource } from './plugin-data-source.entity'
import type { PluginField } from './plugin-field.entity'
import type { PluginTemplate } from './plugin-template.entity'
import type { PluginVariable } from './plugin-variable.entity'
import { Column, CreateDateColumn, Entity, OneToMany, OneToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'

@Entity()
export class Plugin {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column('text')
  name: string

  @Column('text', { nullable: true })
  description?: string

  @Column('text', { default: 'Poll' })
  kind: string = 'Poll'

  @Column('int', { default: 15 })
  refreshInterval: number = 15

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date

  @OneToMany('DevicePlugin', 'plugin')
  deviceAssignments?: DevicePlugin[]

  @OneToOne('PluginDataSource', 'plugin')
  dataSource?: PluginDataSource

  @OneToMany('PluginTemplate', 'plugin')
  templates: PluginTemplate[]

  @OneToMany('PluginField', 'plugin')
  fields: PluginField[]

  @OneToMany('PluginVariable', 'plugin')
  variables: PluginVariable[]
}
