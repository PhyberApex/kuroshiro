import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ServeStaticModule } from '@nestjs/serve-static'
import { TypeOrmModule } from '@nestjs/typeorm'
import config from './config/config.js'
import { DeviceModelsModule } from './device-models/device-models.module.js'
import { DeviceModel } from './device-models/entities/device-model.entity.js'
import { Palette } from './device-models/entities/palette.entity.js'
import { DeviceSensor } from './device-sensors/entities/device-sensor.entity.js'
import { Device } from './devices/devices.entity.js'
import { DevicesModule } from './devices/devices.module.js'
import { Firmware } from './firmware/entities/firmware.entity.js'
import { FirmwareModule } from './firmware/firmware.module.js'
import { LogEntry } from './logs/logs.entity.js'
import { LogsModule } from './logs/logs.module.js'
import { MaintenanceModule } from './maintenance/maintenance.module.js'
import { MashupConfiguration } from './mashup/entities/mashup-configuration.entity.js'
import { MashupSlot } from './mashup/entities/mashup-slot.entity.js'
import { MashupModule } from './mashup/mashup.module.js'
import { DevicePlugin } from './plugins/entities/device-plugin.entity.js'
import { PluginDataSource } from './plugins/entities/plugin-data-source.entity.js'
import { PluginFieldValue } from './plugins/entities/plugin-field-value.entity.js'
import { PluginField } from './plugins/entities/plugin-field.entity.js'
import { PluginTemplate } from './plugins/entities/plugin-template.entity.js'
import { PluginVariable } from './plugins/entities/plugin-variable.entity.js'
import { Plugin } from './plugins/entities/plugin.entity.js'
import { PluginsModule } from './plugins/plugins.module.js'
import { Schedule } from './schedule/schedule.entity.js'
import { ScheduleModule } from './schedule/schedule.module.js'
import { Screen } from './screens/screens.entity.js'
import { ScreensModule } from './screens/screens.module.js'
import { resolveAppPath } from './utils/pathHelper.js'

const conf = config()

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [config],
    }),
    // Serve ui files
    ServeStaticModule.forRoot({
      rootPath: resolveAppPath('public'),
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: conf.database.host,
      port: conf.database.port,
      username: conf.database.user,
      password: conf.database.password,
      database: conf.database.database,
      entities: [Device, DeviceModel, Palette, DeviceSensor, Screen, LogEntry, Plugin, DevicePlugin, PluginDataSource, PluginTemplate, PluginField, PluginFieldValue, PluginVariable, MashupConfiguration, MashupSlot, Schedule, Firmware],
      migrations: (() => {
        const dir = path.join(process.cwd(), 'dist', 'src', 'migrations')
        if (!fs.existsSync(dir))
          return []
        return fs.readdirSync(dir)
          .filter((f: string) => f.endsWith('.js'))
          .map((f: string) => path.join(dir, f))
      })(),
      migrationsTableName: 'migrations',
      migrationsRun: false,
      synchronize: false,
      logging: process.env.NODE_ENV !== 'production',
    }),
    TypeOrmModule.forFeature([Device, Screen, LogEntry]),
    ScreensModule,
    LogsModule,
    DeviceModelsModule,
    FirmwareModule,
    DevicesModule,
    PluginsModule,
    MashupModule,
    ScheduleModule,
    MaintenanceModule,
  ],
})
export class AppModule {}
