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
      migrations: ['dist/src/migrations/*.js'],
      migrationsTableName: 'migrations',
      migrationsRun: true,
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
