import type { ScheduleInput, ScreenRead } from 'kuroshiro-shared'
import type { DataSource } from 'typeorm'
import type { HttpTestApp } from '../../test/httpApp.js'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { Alert } from '../../alerts/entities/alert.entity.js'
import { Device } from '../../devices/devices.entity.js'
import { PluginFieldValue } from '../../plugins/entities/plugin-field-value.entity.js'
import { PluginField } from '../../plugins/entities/plugin-field.entity.js'
import { PluginFieldValuesService } from '../../plugins/services/plugin-field-values.service.js'
import { ScreenReadsService } from '../../screens/screen-reads.service.js'
import { Screen } from '../../screens/screens.entity.js'
import { createHttpTestApp } from '../../test/httpApp.js'
import { createTestDatabase } from '../../test/testDatabase.js'
import { ScheduleController } from '../schedule.controller.js'
import { Schedule } from '../schedule.entity.js'
import { ScheduleService } from '../schedule.service.js'

const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000'
const PAST_RANGE = { startDate: '2020-01-01', endDate: '2020-12-31' }

describe('writing a Screen\'s Schedule, against a real database', () => {
  let database: DataSource
  let http: HttpTestApp
  let device: Device

  beforeAll(async () => {
    database = await createTestDatabase()
    const fieldValues = new PluginFieldValuesService(database.getRepository(PluginFieldValue), database.getRepository(PluginField))
    http = await createHttpTestApp({
      controllers: [ScheduleController],
      providers: [
        {
          provide: ScreenReadsService,
          useValue: new ScreenReadsService(database.getRepository(Screen), database.getRepository(Device), database.getRepository(Alert), fieldValues),
        },
        { provide: ScheduleService, useValue: new ScheduleService(database.getRepository(Schedule), database.getRepository(Screen)) },
      ],
    })
  })

  beforeEach(async () => {
    await database.getRepository(Device).createQueryBuilder().delete().execute()
    device = await database.getRepository(Device).save({ name: 'Kitchen', friendlyId: 'ABC123', mac: 'AA:BB:CC:DD:EE:01', apikey: 'device-secret', refreshRate: 300 })
  })

  afterAll(async () => {
    await http.app.close()
    await database.destroy()
  })

  async function seedScreen(order: number, isActive = false): Promise<Screen> {
    return database.getRepository(Screen).save({ type: 'html', filename: `Screen ${order}`, html: '<p>Hi</p>', order, isActive, fetchManual: false, generatedAt: new Date(), device })
  }

  /** The Active Screen and, after it, the Screen whose Schedule is written. */
  async function seedScreenAfterTheActiveOne(schedule?: ScheduleInput): Promise<Screen> {
    await seedScreen(1, true)
    const screen = await seedScreen(2)
    if (schedule)
      await database.getRepository(Schedule).save({ ...schedule, screen })
    return screen
  }

  function send(method: string, screenId: string, body?: ScheduleInput): Promise<Response> {
    return http.request(`/api/screens/${screenId}/schedule`, {
      method,
      ...(body && { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
    })
  }

  async function storedSchedules(): Promise<Schedule[]> {
    return database.getRepository(Schedule).find()
  }

  describe('pOST /api/screens/:screenId/schedule', () => {
    it('answers 201 with the owning ScreenRead, its Schedule on for every day and all day', async () => {
      const screen = await seedScreenAfterTheActiveOne()

      const response = await send('POST', screen.id, {})
      const read: ScreenRead = await response.json()

      expect(response.status).toBe(201)
      expect(read).toMatchObject({
        id: screen.id,
        deviceId: device.id,
        name: 'Screen 2',
        state: 'upNext',
        schedule: { enabled: true, weekdays: null, startTime: null, endTime: null, startDate: null, endDate: null },
      })
      expect(read.schedule?.id).toBe((await storedSchedules())[0].id)
    })

    it('answers the Screen State as the new Schedule leaves it', async () => {
      const screen = await seedScreenAfterTheActiveOne()

      const off = await send('POST', screen.id, { enabled: false, weekdays: [1, 2] })

      expect(await off.json()).toMatchObject({ state: 'scheduleOff', schedule: { enabled: false, weekdays: [1, 2] } })
    })

    it('takes and answers times as HH:MM and dates as YYYY-MM-DD, a window across midnight included', async () => {
      const screen = await seedScreenAfterTheActiveOne()

      const response = await send('POST', screen.id, { startTime: '22:30', endTime: '06:00', ...PAST_RANGE })

      expect(await response.json()).toMatchObject({
        state: 'notToday',
        stateCause: 'dateRange',
        schedule: { startTime: '22:30', endTime: '06:00', ...PAST_RANGE },
      })
    })

    it.each([UNKNOWN_ID, 'not-an-id'])('answers 404 screen-not-found for the unknown Screen %s', async (id) => {
      const response = await send('POST', id, {})

      expect(response.status).toBe(404)
      expect(await response.json()).toMatchObject({ statusCode: 404, code: 'screen-not-found' })
    })

    it('refuses a second Schedule with 400 schedule-exists and keeps the first', async () => {
      const screen = await seedScreenAfterTheActiveOne({ weekdays: [1] })

      const response = await send('POST', screen.id, { weekdays: [2] })

      expect(response.status).toBe(400)
      expect(await response.json()).toMatchObject({ statusCode: 400, code: 'schedule-exists' })
      expect(await storedSchedules()).toMatchObject([{ weekdays: [1] }])
    })

    it.each([
      [{ startTime: '07:00' }, 'endTime'],
      [{ endTime: '07:00' }, 'startTime'],
      [{ startDate: '2026-05-01' }, 'endDate'],
      [{ endDate: '2026-05-01' }, 'startDate'],
      [{ startDate: '2026-05-10', endDate: '2026-05-01' }, 'startDate'],
      [{ startTime: '7:00', endTime: '09:00' }, 'startTime'],
      [{ startTime: '07:00:00', endTime: '09:00' }, 'startTime'],
      [{ startDate: '01.05.2026', endDate: '2026-05-10' }, 'startDate'],
      [{ weekdays: [7] }, 'weekdays'],
      [{ weekdays: [1, 1] }, 'weekdays'],
    ] as Array<[ScheduleInput, string]>)('refuses %j with 400 validation, naming %s, and stores nothing', async (input, path) => {
      const screen = await seedScreenAfterTheActiveOne()

      const response = await send('POST', screen.id, input)
      const refusal = await response.json()

      expect(response.status).toBe(400)
      expect(refusal).toMatchObject({ statusCode: 400, code: 'validation' })
      expect(refusal.fields.map((field: { path: string }) => field.path)).toEqual([path])
      expect(await storedSchedules()).toEqual([])
    })
  })

  describe('pATCH /api/screens/:screenId/schedule', () => {
    it('switches the Schedule off, keeps its days and hours, and answers the ScreenRead with the state that follows', async () => {
      const screen = await seedScreenAfterTheActiveOne({ weekdays: [1, 2, 3, 4, 5], startTime: '06:00', endTime: '09:00' })

      const response = await send('PATCH', screen.id, { enabled: false })

      expect(response.status).toBe(200)
      expect(await response.json()).toMatchObject({
        id: screen.id,
        state: 'scheduleOff',
        schedule: { enabled: false, weekdays: [1, 2, 3, 4, 5], startTime: '06:00', endTime: '09:00', startDate: null, endDate: null },
      })
    })

    it('clears what is sent as null and leaves the rest alone', async () => {
      const screen = await seedScreenAfterTheActiveOne({ weekdays: [0, 6], startTime: '06:00', endTime: '09:00', ...PAST_RANGE })

      const response = await send('PATCH', screen.id, { startDate: null, endDate: null, startTime: null, endTime: null })

      expect(await response.json()).toMatchObject({
        schedule: { enabled: true, weekdays: [0, 6], startTime: null, endTime: null, startDate: null, endDate: null },
      })
    })

    it('changes the hours alone, answered as HH:MM', async () => {
      const screen = await seedScreenAfterTheActiveOne({ startTime: '06:00', endTime: '09:00' })

      const response = await send('PATCH', screen.id, { startTime: '21:00', endTime: '05:30' })

      expect(await response.json()).toMatchObject({ schedule: { startTime: '21:00', endTime: '05:30' } })
    })

    it.each([
      [{ startTime: null }, 'startTime'],
      [{ endDate: null }, 'endDate'],
      [{ startDate: '2021-01-01' }, 'startDate'],
      [{ enabled: null }, 'enabled'],
    ] as Array<[ScheduleInput, string]>)('refuses %j with 400 validation, naming %s, and keeps the Schedule as it was', async (input, path) => {
      const screen = await seedScreenAfterTheActiveOne({ startTime: '06:00', endTime: '09:00', ...PAST_RANGE })

      const response = await send('PATCH', screen.id, input)
      const refusal = await response.json()

      expect(response.status).toBe(400)
      expect(refusal).toMatchObject({ code: 'validation' })
      expect(refusal.fields.map((field: { path: string }) => field.path)).toEqual([path])
      expect(await storedSchedules()).toMatchObject([{ startTime: '06:00:00', endTime: '09:00:00', ...PAST_RANGE }])
    })

    it('answers 404 schedule-not-found for a Screen without a Schedule, and 404 screen-not-found for no Screen', async () => {
      const screen = await seedScreenAfterTheActiveOne()

      const withoutSchedule = await send('PATCH', screen.id, { enabled: false })
      const withoutScreen = await send('PATCH', UNKNOWN_ID, { enabled: false })

      expect(withoutSchedule.status).toBe(404)
      expect(await withoutSchedule.json()).toMatchObject({ code: 'schedule-not-found' })
      expect(withoutScreen.status).toBe(404)
      expect(await withoutScreen.json()).toMatchObject({ code: 'screen-not-found' })
    })
  })

  describe('dELETE /api/screens/:screenId/schedule', () => {
    it('removes the Schedule and answers the ScreenRead, which Rotation no longer passes over', async () => {
      const screen = await seedScreenAfterTheActiveOne({ enabled: false })

      const response = await send('DELETE', screen.id)

      expect(response.status).toBe(200)
      expect(await response.json()).toMatchObject({ id: screen.id, state: 'upNext', schedule: null })
      expect(await storedSchedules()).toEqual([])
    })

    it('answers 404 schedule-not-found for a Screen without a Schedule', async () => {
      const screen = await seedScreenAfterTheActiveOne()

      const response = await send('DELETE', screen.id)

      expect(response.status).toBe(404)
      expect(await response.json()).toMatchObject({ code: 'schedule-not-found' })
    })
  })

  it('no longer answers GET /api/screens/:screenId/schedule', async () => {
    const screen = await seedScreenAfterTheActiveOne({ weekdays: [1] })

    const response = await send('GET', screen.id)

    expect(response.status).toBe(404)
  })
})
