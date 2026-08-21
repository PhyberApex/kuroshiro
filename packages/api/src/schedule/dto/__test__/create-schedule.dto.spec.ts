import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { describe, expect, it } from 'vitest'
import { CreateScheduleDto } from '../create-schedule.dto'
import { UpdateScheduleDto } from '../update-schedule.dto'

async function rejectedFields(dto: object): Promise<string[]> {
  const errors = await validate(dto)
  return errors.map(error => error.property)
}

describe('create-schedule dto', () => {
  it('accepts a fully specified schedule', async () => {
    const dto = plainToInstance(CreateScheduleDto, {
      enabled: true,
      weekdays: [1, 2, 3, 4, 5],
      startTime: '07:00',
      endTime: '09:00',
      startDate: '2026-12-01',
      endDate: '2026-12-25',
    })

    await expect(rejectedFields(dto)).resolves.toEqual([])
  })

  it('accepts a schedule with no constraints at all', async () => {
    await expect(rejectedFields(plainToInstance(CreateScheduleDto, {}))).resolves.toEqual([])
  })

  it('rejects a weekday outside 0..6', async () => {
    await expect(rejectedFields(plainToInstance(CreateScheduleDto, { weekdays: [7] }))).resolves.toEqual(['weekdays'])
    await expect(rejectedFields(plainToInstance(CreateScheduleDto, { weekdays: [-1] }))).resolves.toEqual(['weekdays'])
  })

  it('rejects a duplicated weekday', async () => {
    await expect(rejectedFields(plainToInstance(CreateScheduleDto, { weekdays: [1, 1] }))).resolves.toEqual(['weekdays'])
  })

  it('rejects a malformed time of day', async () => {
    await expect(rejectedFields(plainToInstance(CreateScheduleDto, { startTime: '7am' }))).resolves.toEqual(['startTime'])
    await expect(rejectedFields(plainToInstance(CreateScheduleDto, { endTime: '25:00' }))).resolves.toEqual(['endTime'])
  })

  it('rejects a malformed date', async () => {
    await expect(rejectedFields(plainToInstance(CreateScheduleDto, { startDate: '01-12-2026' }))).resolves.toEqual(['startDate'])
    await expect(rejectedFields(plainToInstance(CreateScheduleDto, { endDate: '2026-13-01' }))).resolves.toEqual(['endDate'])
  })
})

describe('update-schedule dto', () => {
  it('accepts nulls, which clear the constraints they carry', async () => {
    const dto = plainToInstance(UpdateScheduleDto, {
      weekdays: null,
      startTime: null,
      endTime: null,
      startDate: null,
      endDate: null,
    })

    await expect(rejectedFields(dto)).resolves.toEqual([])
  })

  it('still rejects malformed values', async () => {
    await expect(rejectedFields(plainToInstance(UpdateScheduleDto, { startTime: '7am' }))).resolves.toEqual(['startTime'])
    await expect(rejectedFields(plainToInstance(UpdateScheduleDto, { weekdays: [9] }))).resolves.toEqual(['weekdays'])
  })
})
