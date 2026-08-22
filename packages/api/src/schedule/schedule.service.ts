import type { CreateScheduleDto } from './dto/create-schedule.dto'
import type { UpdateScheduleDto } from './dto/update-schedule.dto'
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Screen } from '../screens/screens.entity'
import { Schedule } from './schedule.entity'

@Injectable()
export class ScheduleService {
  private readonly logger = new Logger(ScheduleService.name)

  constructor(
    @InjectRepository(Schedule)
    private readonly scheduleRepository: Repository<Schedule>,
    @InjectRepository(Screen)
    private readonly screenRepository: Repository<Screen>,
  ) {}

  async create(screenId: string, dto: CreateScheduleDto): Promise<Schedule> {
    this.logger.log(`Creating schedule for screen ${screenId}`)
    const screen = await this.screenRepository.findOne({ where: { id: screenId } })
    if (!screen) {
      this.logger.warn(`Screen not found: ${screenId}`)
      throw new NotFoundException('Screen not found')
    }

    const existing = await this.scheduleRepository.findOne({ where: { screen: { id: screenId } } })
    if (existing) {
      throw new BadRequestException('Screen already has a schedule')
    }

    const schedule = this.scheduleRepository.create({
      enabled: dto.enabled ?? true,
      weekdays: dto.weekdays ?? null,
      startTime: dto.startTime ?? null,
      endTime: dto.endTime ?? null,
      startDate: dto.startDate ?? null,
      endDate: dto.endDate ?? null,
      screen,
    })
    assertCoherentSchedule(schedule)

    const saved = await this.scheduleRepository.save(schedule)
    this.logger.log(`Schedule created with id: ${saved.id} for screen ${screenId}`)
    return saved
  }

  async getByScreen(screenId: string): Promise<Schedule> {
    const schedule = await this.scheduleRepository.findOne({ where: { screen: { id: screenId } } })
    if (!schedule) {
      throw new NotFoundException('Schedule not found')
    }
    return schedule
  }

  async update(screenId: string, dto: UpdateScheduleDto): Promise<Schedule> {
    this.logger.log(`Updating schedule for screen ${screenId}`)
    const schedule = await this.getByScreen(screenId)

    if (dto.enabled !== undefined)
      schedule.enabled = dto.enabled
    if (dto.weekdays !== undefined)
      schedule.weekdays = dto.weekdays
    if (dto.startTime !== undefined)
      schedule.startTime = dto.startTime
    if (dto.endTime !== undefined)
      schedule.endTime = dto.endTime
    if (dto.startDate !== undefined)
      schedule.startDate = dto.startDate
    if (dto.endDate !== undefined)
      schedule.endDate = dto.endDate
    assertCoherentSchedule(schedule)

    const saved = await this.scheduleRepository.save(schedule)
    this.logger.log(`Schedule updated for screen ${screenId}`)
    return saved
  }

  async delete(screenId: string): Promise<void> {
    this.logger.log(`Deleting schedule for screen ${screenId}`)
    const schedule = await this.getByScreen(screenId)
    await this.scheduleRepository.remove(schedule)
    this.logger.log(`Schedule deleted for screen ${screenId}`)
  }
}

function assertCoherentSchedule(schedule: Schedule): void {
  if (Boolean(schedule.startTime) !== Boolean(schedule.endTime))
    throw new BadRequestException('A time-of-day window needs both startTime and endTime')
  if (Boolean(schedule.startDate) !== Boolean(schedule.endDate))
    throw new BadRequestException('A date range needs both startDate and endDate')
  if (schedule.startDate && schedule.endDate && schedule.startDate > schedule.endDate)
    throw new BadRequestException('startDate must not be after endDate')
}
