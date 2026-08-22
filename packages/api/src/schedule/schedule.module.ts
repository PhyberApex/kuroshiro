import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Screen } from '../screens/screens.entity'
import { ScheduleController } from './schedule.controller'
import { Schedule } from './schedule.entity'
import { ScheduleService } from './schedule.service'

@Module({
  imports: [TypeOrmModule.forFeature([Schedule, Screen])],
  controllers: [ScheduleController],
  providers: [ScheduleService],
  exports: [ScheduleService],
})
export class ScheduleModule {}
