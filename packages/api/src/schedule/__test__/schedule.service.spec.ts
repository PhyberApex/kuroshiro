import type { Screen } from '../../screens/screens.entity.js'
import type { Schedule } from '../schedule.entity.js'
import { BadRequestException, NotFoundException } from '@nestjs/common'
import { beforeEach, describe, expect, it } from 'vitest'
import { makeSchedule, makeScreen } from '../../test/fixtures.js'
import { asRepository, createMockRepository } from '../../test/mockRepository.js'
import { ScheduleService } from '../schedule.service.js'

describe('scheduleService', () => {
  let service: ScheduleService
  let scheduleRepo: ReturnType<typeof createMockRepository<Schedule>>
  let screenRepo: ReturnType<typeof createMockRepository<Screen>>

  beforeEach(() => {
    scheduleRepo = createMockRepository<Schedule>()
    screenRepo = createMockRepository<Screen>()
    service = new ScheduleService(asRepository(scheduleRepo), asRepository(screenRepo))
  })

  const screen = makeScreen({ id: 'screen-1' })

  describe('create', () => {
    it('attaches a schedule carrying the requested day and time constraints', async () => {
      screenRepo.findOne.mockResolvedValue(screen)
      scheduleRepo.findOne.mockResolvedValue(null)

      const result = await service.create('screen-1', {
        weekdays: [1, 2, 3, 4, 5],
        startTime: '07:00',
        endTime: '09:00',
      })

      expect(result).toMatchObject({
        enabled: true,
        weekdays: [1, 2, 3, 4, 5],
        startTime: '07:00',
        endTime: '09:00',
        startDate: null,
        endDate: null,
        screen,
      })
    })

    it('defaults to an enabled schedule with no constraints at all', async () => {
      screenRepo.findOne.mockResolvedValue(screen)
      scheduleRepo.findOne.mockResolvedValue(null)

      const result = await service.create('screen-1', {})

      expect(result).toMatchObject({ enabled: true, weekdays: null, startTime: null, endTime: null })
    })

    it('accepts a schedule that is created already disabled', async () => {
      screenRepo.findOne.mockResolvedValue(screen)
      scheduleRepo.findOne.mockResolvedValue(null)

      const result = await service.create('screen-1', { enabled: false, weekdays: [0] })

      expect(result).toMatchObject({ enabled: false })
    })

    it('throws NotFoundException when the screen does not exist', async () => {
      screenRepo.findOne.mockResolvedValue(null)

      await expect(service.create('missing', {})).rejects.toThrow(NotFoundException)
      expect(scheduleRepo.save).not.toHaveBeenCalled()
    })

    it('refuses a second schedule on an already scheduled screen', async () => {
      screenRepo.findOne.mockResolvedValue(screen)
      scheduleRepo.findOne.mockResolvedValue(makeSchedule({ id: 'schedule-1' }))

      await expect(service.create('screen-1', {})).rejects.toThrow(BadRequestException)
      expect(scheduleRepo.save).not.toHaveBeenCalled()
    })

    it('rejects a half-specified time window', async () => {
      screenRepo.findOne.mockResolvedValue(screen)
      scheduleRepo.findOne.mockResolvedValue(null)

      await expect(service.create('screen-1', { startTime: '07:00' })).rejects.toThrow(BadRequestException)
      expect(scheduleRepo.save).not.toHaveBeenCalled()
    })

    it('rejects a half-specified date range', async () => {
      screenRepo.findOne.mockResolvedValue(screen)
      scheduleRepo.findOne.mockResolvedValue(null)

      await expect(service.create('screen-1', { endDate: '2026-12-25' })).rejects.toThrow(BadRequestException)
      expect(scheduleRepo.save).not.toHaveBeenCalled()
    })

    it('rejects a date range that ends before it starts', async () => {
      screenRepo.findOne.mockResolvedValue(screen)
      scheduleRepo.findOne.mockResolvedValue(null)

      await expect(service.create('screen-1', { startDate: '2026-12-25', endDate: '2026-12-01' })).rejects.toThrow(BadRequestException)
      expect(scheduleRepo.save).not.toHaveBeenCalled()
    })

    it('accepts a time window that spans midnight', async () => {
      screenRepo.findOne.mockResolvedValue(screen)
      scheduleRepo.findOne.mockResolvedValue(null)

      const result = await service.create('screen-1', { startTime: '22:00', endTime: '02:00' })

      expect(result).toMatchObject({ startTime: '22:00', endTime: '02:00' })
    })
  })

  describe('getByScreen', () => {
    it('returns the screen\'s schedule', async () => {
      const schedule = makeSchedule({ id: 'schedule-1', enabled: true })
      scheduleRepo.findOne.mockResolvedValue(schedule)

      await expect(service.getByScreen('screen-1')).resolves.toBe(schedule)
    })

    it('throws NotFoundException when the screen has no schedule', async () => {
      scheduleRepo.findOne.mockResolvedValue(null)

      await expect(service.getByScreen('screen-1')).rejects.toThrow(NotFoundException)
    })
  })

  describe('update', () => {
    it('disables a schedule without discarding its day and time rules', async () => {
      scheduleRepo.findOne.mockResolvedValue(makeSchedule({ id: 'schedule-1', enabled: true, weekdays: [1], startTime: '07:00', endTime: '09:00' }))

      const result = await service.update('screen-1', { enabled: false })

      expect(result).toMatchObject({ enabled: false, weekdays: [1], startTime: '07:00', endTime: '09:00' })
    })

    it('leaves omitted constraints untouched', async () => {
      scheduleRepo.findOne.mockResolvedValue(makeSchedule({ id: 'schedule-1', enabled: true, weekdays: [1], startDate: '2026-12-01', endDate: '2026-12-25' }))

      const result = await service.update('screen-1', { weekdays: [2, 3] })

      expect(result).toMatchObject({ weekdays: [2, 3], startDate: '2026-12-01', endDate: '2026-12-25' })
    })

    it('clears a constraint that is sent as null', async () => {
      scheduleRepo.findOne.mockResolvedValue(makeSchedule({ id: 'schedule-1', enabled: true, startTime: '07:00', endTime: '09:00' }))

      const result = await service.update('screen-1', { startTime: null, endTime: null })

      expect(result).toMatchObject({ startTime: null, endTime: null })
    })

    it('rejects an update that would leave half a time window behind', async () => {
      scheduleRepo.findOne.mockResolvedValue(makeSchedule({ id: 'schedule-1', enabled: true, startTime: '07:00', endTime: '09:00' }))

      await expect(service.update('screen-1', { endTime: null })).rejects.toThrow(BadRequestException)
      expect(scheduleRepo.save).not.toHaveBeenCalled()
    })

    it('throws NotFoundException when the screen has no schedule', async () => {
      scheduleRepo.findOne.mockResolvedValue(null)

      await expect(service.update('screen-1', { enabled: false })).rejects.toThrow(NotFoundException)
    })
  })

  describe('delete', () => {
    it('removes the schedule so the screen becomes always eligible again', async () => {
      const schedule = makeSchedule({ id: 'schedule-1' })
      scheduleRepo.findOne.mockResolvedValue(schedule)

      await service.delete('screen-1')

      expect(scheduleRepo.remove).toHaveBeenCalledWith(schedule)
    })

    it('throws NotFoundException when the screen has no schedule', async () => {
      scheduleRepo.findOne.mockResolvedValue(null)

      await expect(service.delete('screen-1')).rejects.toThrow(NotFoundException)
      expect(scheduleRepo.remove).not.toHaveBeenCalled()
    })
  })
})
