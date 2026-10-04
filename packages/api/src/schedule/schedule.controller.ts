import type { ScreenRead } from 'kuroshiro-shared'
import { Body, Controller, Delete, Param, Patch, Post } from '@nestjs/common'
import { ScreenReadsService } from '../screens/screen-reads.service.js'
import { ScheduleDto } from './dto/schedule.dto.js'
import { ScheduleService } from './schedule.service.js'

/** Every write answers the owning Screen, whose Screen State the Schedule has just moved. */
@Controller('screens/:screenId/schedule')
export class ScheduleController {
  constructor(private readonly scheduleService: ScheduleService, private readonly screenReads: ScreenReadsService) {}

  @Post()
  async create(@Param('screenId') screenId: string, @Body() dto: ScheduleDto): Promise<ScreenRead> {
    await this.scheduleService.create(screenId, dto)
    return this.screenReads.forScreen(screenId)
  }

  @Patch()
  async update(@Param('screenId') screenId: string, @Body() dto: ScheduleDto): Promise<ScreenRead> {
    await this.scheduleService.update(screenId, dto)
    return this.screenReads.forScreen(screenId)
  }

  @Delete()
  async delete(@Param('screenId') screenId: string): Promise<ScreenRead> {
    await this.scheduleService.delete(screenId)
    return this.screenReads.forScreen(screenId)
  }
}
