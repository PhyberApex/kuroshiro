import process from 'node:process'
import { DataSource } from 'typeorm'
import { DeviceModel } from '../device-models/entities/device-model.entity.js'
import { Palette } from '../device-models/entities/palette.entity.js'
import { DeviceSensor } from '../device-sensors/entities/device-sensor.entity.js'
import { Device } from '../devices/devices.entity.js'
import { Firmware } from '../firmware/entities/firmware.entity.js'
import { LogEntry } from '../logs/logs.entity.js'
import { MashupConfiguration } from '../mashup/entities/mashup-configuration.entity.js'
import { MashupSlot } from '../mashup/entities/mashup-slot.entity.js'
import { DevicePlugin } from '../plugins/entities/device-plugin.entity.js'
import { PluginDataSource } from '../plugins/entities/plugin-data-source.entity.js'
import { PluginFieldValue } from '../plugins/entities/plugin-field-value.entity.js'
import { PluginField } from '../plugins/entities/plugin-field.entity.js'
import { PluginTemplate } from '../plugins/entities/plugin-template.entity.js'
import { PluginVariable } from '../plugins/entities/plugin-variable.entity.js'
import { Plugin } from '../plugins/entities/plugin.entity.js'
import { Schedule } from '../schedule/schedule.entity.js'
import { Screen } from '../screens/screens.entity.js'

const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.KUROSHIRO_DB_HOST || 'localhost',
  port: Number.parseInt(process.env.KUROSHIRO_DB_PORT || '5432', 10),
  username: process.env.KUROSHIRO_DB_USER || 'root',
  password: process.env.KUROSHIRO_DB_PASSWORD || 'root',
  database: process.env.KUROSHIRO_DB_DB || 'test',
  entities: [Device, DeviceModel, Palette, DeviceSensor, Screen, LogEntry, Plugin, DevicePlugin, PluginDataSource, PluginTemplate, PluginField, PluginFieldValue, PluginVariable, MashupConfiguration, MashupSlot, Schedule, Firmware],
  migrations: ['dist/src/migrations/*.js'],
  migrationsTableName: 'migrations',
  synchronize: false,
  logging: process.env.NODE_ENV !== 'production',
})

export default AppDataSource
