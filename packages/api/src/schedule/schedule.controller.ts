import { Body, Controller, Delete, Get, Param, Patch, Post, UsePipes, ValidationPipe } from '@nestjs/common'
import { CreateScheduleDto } from './dto/create-schedule.dto.js'
import { UpdateScheduleDto } from './dto/update-schedule.dto.js'
import { Schedule } from './schedule.entity.js'
import { ScheduleService } from './schedule.service.js'

@Controller('screens/:screenId/schedule')
export class ScheduleController {
  constructor(private readonly scheduleService: ScheduleService) {}

  @Get()
  async get(@Param('screenId') screenId: string): Promise<Schedule> {
    return this.scheduleService.getByScreen(screenId)
  }

  @Post()
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async create(@Param('screenId') screenId: string, @Body() dto: CreateScheduleDto): Promise<Schedule> {
    return this.scheduleService.create(screenId, dto)
  }

  @Patch()
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async update(@Param('screenId') screenId: string, @Body() dto: UpdateScheduleDto): Promise<Schedule> {
    return this.scheduleService.update(screenId, dto)
  }

  @Delete()
  async delete(@Param('screenId') screenId: string): Promise<void> {
    return this.scheduleService.delete(screenId)
  }
}
