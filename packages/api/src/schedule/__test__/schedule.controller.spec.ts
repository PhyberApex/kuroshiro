import type { ScheduleService } from '../schedule.service'
import { NotFoundException } from '@nestjs/common'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { asService } from '../../test/mockService'
import { ScheduleController } from '../schedule.controller'

describe('scheduleController', () => {
  let controller: ScheduleController
  let mockService: { create: ReturnType<typeof vi.fn>, getByScreen: ReturnType<typeof vi.fn>, update: ReturnType<typeof vi.fn>, delete: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    mockService = {
      create: vi.fn(),
      getByScreen: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    }

    controller = new ScheduleController(asService<ScheduleService>(mockService))
  })

  it('creates a schedule for the screen in the route', async () => {
    const schedule = { id: 'schedule-1' }
    mockService.create.mockResolvedValue(schedule)

    const result = await controller.create('screen-1', { weekdays: [1] })

    expect(mockService.create).toHaveBeenCalledWith('screen-1', { weekdays: [1] })
    expect(result).toBe(schedule)
  })

  it('returns the screen\'s schedule', async () => {
    const schedule = { id: 'schedule-1' }
    mockService.getByScreen.mockResolvedValue(schedule)

    await expect(controller.get('screen-1')).resolves.toBe(schedule)
  })

  it('surfaces a missing schedule as a NotFoundException', async () => {
    mockService.getByScreen.mockRejectedValue(new NotFoundException('Schedule not found'))

    await expect(controller.get('screen-1')).rejects.toThrow(NotFoundException)
  })

  it('updates the schedule for the screen in the route', async () => {
    const schedule = { id: 'schedule-1', enabled: false }
    mockService.update.mockResolvedValue(schedule)

    const result = await controller.update('screen-1', { enabled: false })

    expect(mockService.update).toHaveBeenCalledWith('screen-1', { enabled: false })
    expect(result).toBe(schedule)
  })

  it('deletes the schedule for the screen in the route', async () => {
    mockService.delete.mockResolvedValue(undefined)

    await controller.delete('screen-1')

    expect(mockService.delete).toHaveBeenCalledWith('screen-1')
  })
})
