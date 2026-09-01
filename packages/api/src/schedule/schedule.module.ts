import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Screen } from '../screens/screens.entity.js'
import { ScheduleController } from './schedule.controller.js'
import { Schedule } from './schedule.entity.js'
import { ScheduleService } from './schedule.service.js'

@Module({
  imports: [TypeOrmModule.forFeature([Schedule, Screen])],
  controllers: [ScheduleController],
  providers: [ScheduleService],
  exports: [ScheduleService],
})
export class ScheduleModule {}
