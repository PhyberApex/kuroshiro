import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ServeStaticModule } from '@nestjs/serve-static'
import { TypeOrmModule } from '@nestjs/typeorm'
import config from './config/config'
import { Device } from './devices/devices.entity'
import { DevicesModule } from './devices/devices.module'
import { LogEntry } from './logs/logs.entity'
import { LogsModule } from './logs/logs.module'
import { MaintenanceModule } from './maintenance/maintenance.module'
import { MashupConfiguration } from './mashup/entities/mashup-configuration.entity'
import { MashupSlot } from './mashup/entities/mashup-slot.entity'
import { MashupModule } from './mashup/mashup.module'
import { DevicePlugin } from './plugins/entities/device-plugin.entity'
import { PluginDataSource } from './plugins/entities/plugin-data-source.entity'
import { PluginFieldValue } from './plugins/entities/plugin-field-value.entity'
import { PluginField } from './plugins/entities/plugin-field.entity'
import { PluginTemplate } from './plugins/entities/plugin-template.entity'
import { PluginVariable } from './plugins/entities/plugin-variable.entity'
import { Plugin } from './plugins/entities/plugin.entity'
import { PluginsModule } from './plugins/plugins.module'
import { Screen } from './screens/screens.entity'
import { ScreensModule } from './screens/screens.module'
import { resolveAppPath } from './utils/pathHelper'

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
      entities: [Device, Screen, LogEntry, Plugin, DevicePlugin, PluginDataSource, PluginTemplate, PluginField, PluginFieldValue, PluginVariable, MashupConfiguration, MashupSlot],
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
    DevicesModule,
    PluginsModule,
    MashupModule,
    MaintenanceModule,
  ],
})
export class AppModule {}
