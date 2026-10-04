import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Screen } from '../screens/screens.entity.js'
import { ScreensModule } from '../screens/screens.module.js'
import { ScheduleController } from './schedule.controller.js'
import { Schedule } from './schedule.entity.js'
import { ScheduleService } from './schedule.service.js'

@Module({
  imports: [TypeOrmModule.forFeature([Schedule, Screen]), ScreensModule],
  controllers: [ScheduleController],
  providers: [ScheduleService],
})
export class ScheduleModule {}
