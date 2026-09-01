import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Device } from '../devices/devices.entity.js'
import { LogsController } from './logs.controller.js'
import { LogEntry } from './logs.entity.js'
import { LogsService } from './logs.service.js'

@Module({
  imports: [TypeOrmModule.forFeature([LogEntry, Device])],
  controllers: [LogsController],
  providers: [LogsService],
})
export class LogsModule {}
