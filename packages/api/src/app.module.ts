import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ServeStaticModule } from '@nestjs/serve-static'
import { TypeOrmModule } from '@nestjs/typeorm'
import config from 'src/config/config'
import { Device } from 'src/devices/devices.entity'
import { DevicesModule } from 'src/devices/devices.module'
import { LogEntry } from 'src/logs/logs.entity'
import { LogsModule } from 'src/logs/logs.module'
import { Screen } from 'src/screens/screens.entity'
import { ScreensModule } from 'src/screens/screens.module'
import { resolveAppPath } from 'src/utils/pathHelper'

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
      entities: [Device, Screen, LogEntry],
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
  ],
})
export class AppModule {}
