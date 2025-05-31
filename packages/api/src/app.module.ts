import { join } from 'node:path'
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ServeStaticModule } from '@nestjs/serve-static'
import { TypeOrmModule } from '@nestjs/typeorm'
import config from './config/config'
import { Device } from './devices/devices.entity'
import { DevicesModule } from './devices/devices.module'
import { LogsModule } from './logs/logs.module'
import { Screen } from './screens/screens.entity'
import { ScreensModule } from './screens/screens.module'

const conf = config()

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [config],
    }),
    // Serve ui files
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'public'),
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: conf.database.host,
      port: conf.database.port,
      username: conf.database.user,
      password: conf.database.password,
      database: conf.database.database,
      entities: [Device, Screen],
      synchronize: true,
    }),
    TypeOrmModule.forFeature([Device, Screen]),
    ScreensModule,
    LogsModule,
    DevicesModule,
  ],
})
export class AppModule {}
