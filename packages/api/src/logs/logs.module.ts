import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Device } from '../devices/devices.entity'
import { LogsController } from './logs.controller'
import { LogEntry } from './logs.entity'
import { LogsService } from './logs.service'

@Module({
  imports: [TypeOrmModule.forFeature([LogEntry, Device])],
  controllers: [LogsController],
  providers: [LogsService],
})
export class LogsModule {}
