import type { ApiErrorField, ScheduleInput } from 'kuroshiro-shared'
import { HttpStatus, Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { isUUID } from 'class-validator'
import { Repository } from 'typeorm'
import { ApiException, ValidationException } from '../errors/api.exception.js'
import { Screen } from '../screens/screens.entity.js'
import { Schedule } from './schedule.entity.js'

@Injectable()
export class ScheduleService {
  private readonly logger = new Logger(ScheduleService.name)

  constructor(
    @InjectRepository(Schedule)
    private readonly scheduleRepository: Repository<Schedule>,
    @InjectRepository(Screen)
    private readonly screenRepository: Repository<Screen>,
  ) {}

  async create(screenId: string, input: ScheduleInput): Promise<void> {
    const screen = await this.screenOrRefuse(screenId)
    if (screen.schedule)
      throw new ApiException(HttpStatus.BAD_REQUEST, 'schedule-exists', 'Screen already has a schedule', { screenId })

    const schedule = this.scheduleRepository.create({
      enabled: input.enabled ?? true,
      weekdays: input.weekdays ?? null,
      startTime: input.startTime ?? null,
      endTime: input.endTime ?? null,
      startDate: input.startDate ?? null,
      endDate: input.endDate ?? null,
      screen,
    })
    assertCoherentSchedule(schedule)

    const saved = await this.scheduleRepository.save(schedule)
    this.logger.log(`Schedule created with id: ${saved.id} for screen ${screenId}`)
  }

  async update(screenId: string, input: ScheduleInput): Promise<void> {
    const schedule = await this.scheduleOrRefuse(screenId)

    if (input.enabled !== undefined)
      schedule.enabled = input.enabled
    if (input.weekdays !== undefined)
      schedule.weekdays = input.weekdays
    if (input.startTime !== undefined)
      schedule.startTime = input.startTime
    if (input.endTime !== undefined)
      schedule.endTime = input.endTime
    if (input.startDate !== undefined)
      schedule.startDate = input.startDate
    if (input.endDate !== undefined)
      schedule.endDate = input.endDate
    assertCoherentSchedule(schedule)

    await this.scheduleRepository.save(schedule)
    this.logger.log(`Schedule updated for screen ${screenId}`)
  }

  async delete(screenId: string): Promise<void> {
    await this.scheduleRepository.remove(await this.scheduleOrRefuse(screenId))
    this.logger.log(`Schedule deleted for screen ${screenId}`)
  }

  private async screenOrRefuse(screenId: string): Promise<Screen> {
    const screen = isUUID(screenId)
      ? await this.screenRepository.findOne({ where: { id: screenId }, relations: { schedule: true } })
      : null
    if (!screen)
      throw new ApiException(HttpStatus.NOT_FOUND, 'screen-not-found', 'Screen not found', { id: screenId })
    return screen
  }

  private async scheduleOrRefuse(screenId: string): Promise<Schedule> {
    const { schedule } = await this.screenOrRefuse(screenId)
    if (!schedule)
      throw new ApiException(HttpStatus.NOT_FOUND, 'schedule-not-found', 'Schedule not found', { screenId })
    return schedule
  }
}

function missingOfPair(schedule: Schedule, first: 'startTime' | 'startDate', second: 'endTime' | 'endDate', message: string): ApiErrorField[] {
  if (Boolean(schedule[first]) === Boolean(schedule[second]))
    return []
  return [{ path: schedule[first] ? second : first, message }]
}

function assertCoherentSchedule(schedule: Schedule): void {
  const problems = [
    ...missingOfPair(schedule, 'startTime', 'endTime', 'A time-of-day window needs both startTime and endTime'),
    ...missingOfPair(schedule, 'startDate', 'endDate', 'A date range needs both startDate and endDate'),
    ...schedule.startDate && schedule.endDate && schedule.startDate > schedule.endDate
      ? [{ path: 'startDate', message: 'startDate must not be after endDate' }]
      : [],
  ]
  if (problems.length > 0)
    throw new ValidationException(problems)
}
