import process from 'node:process'
import { DataSource } from 'typeorm'
import { Device } from '../devices/devices.entity'
import { LogEntry } from '../logs/logs.entity'
import { MashupConfiguration } from '../mashup/entities/mashup-configuration.entity'
import { MashupSlot } from '../mashup/entities/mashup-slot.entity'
import { DevicePlugin } from '../plugins/entities/device-plugin.entity'
import { PluginDataSource } from '../plugins/entities/plugin-data-source.entity'
import { PluginFieldValue } from '../plugins/entities/plugin-field-value.entity'
import { PluginField } from '../plugins/entities/plugin-field.entity'
import { PluginTemplate } from '../plugins/entities/plugin-template.entity'
import { PluginVariable } from '../plugins/entities/plugin-variable.entity'
import { Plugin } from '../plugins/entities/plugin.entity'
import { Screen } from '../screens/screens.entity'

const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.KUROSHIRO_DB_HOST || 'localhost',
  port: Number.parseInt(process.env.KUROSHIRO_DB_PORT || '5432', 10),
  username: process.env.KUROSHIRO_DB_USER || 'root',
  password: process.env.KUROSHIRO_DB_PASSWORD || 'root',
  database: process.env.KUROSHIRO_DB_DB || 'test',
  entities: [Device, Screen, LogEntry, Plugin, DevicePlugin, PluginDataSource, PluginTemplate, PluginField, PluginFieldValue, PluginVariable, MashupConfiguration, MashupSlot],
  migrations: ['dist/src/migrations/*.js'],
  migrationsTableName: 'migrations',
  synchronize: false,
  logging: process.env.NODE_ENV !== 'production',
})

export default AppDataSource
