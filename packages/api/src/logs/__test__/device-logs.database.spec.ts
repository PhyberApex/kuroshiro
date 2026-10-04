import type { DeviceLogPage } from 'kuroshiro-shared'
import type { DataSource } from 'typeorm'
import type { HttpTestApp } from '../../test/httpApp.js'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { Device } from '../../devices/devices.entity.js'
import { createHttpTestApp } from '../../test/httpApp.js'
import { createTestDatabase } from '../../test/testDatabase.js'
import { DeviceLogsController } from '../device-logs.controller.js'
import { DeviceLogsService } from '../device-logs.service.js'
import { LogsController } from '../logs.controller.js'
import { LogEntry } from '../logs.entity.js'
import { LogsService } from '../logs.service.js'

const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000'
const NINE_O_CLOCK = Date.UTC(2026, 8, 30, 9, 0, 0) / 1000

describe('the Device Log against a real database', () => {
  let database: DataSource
  let http: HttpTestApp
  let kitchen: Device
  let bedroom: Device

  beforeAll(async () => {
    database = await createTestDatabase()
    const devices = database.getRepository(Device)
    const entries = database.getRepository(LogEntry)
    http = await createHttpTestApp({
      controllers: [LogsController, DeviceLogsController],
      providers: [
        { provide: LogsService, useValue: new LogsService(entries, devices) },
        { provide: DeviceLogsService, useValue: new DeviceLogsService(entries, devices) },
      ],
    })
  })

  beforeEach(async () => {
    const devices = database.getRepository(Device)
    await devices.createQueryBuilder().delete().execute()
    kitchen = await devices.save({ name: 'Kitchen', mac: 'AA:BB:CC:DD:EE:01', apikey: 'key-1', friendlyId: 'K1' } as Device)
    bedroom = await devices.save({ name: 'Bedroom', mac: 'AA:BB:CC:DD:EE:02', apikey: 'key-2', friendlyId: 'B2' } as Device)
  })

  afterAll(async () => {
    await http.app.close()
    await database.destroy()
  })

  async function ingest(device: Device, body: unknown): Promise<Response> {
    return http.postJson('/api/log', body, { headers: { id: device.mac } })
  }

  /** One entry per message, a second apart from 09:00:00 on, in the current firmware format. */
  async function report(device: Device, messages: Array<string | { message: string, level?: string, secondsAfterNine?: number }>, firstId = 1): Promise<void> {
    const logs = messages.map((given, index) => {
      const { message, level = 'info', secondsAfterNine = index } = typeof given === 'string' ? { message: given } : given
      return { id: firstId + index, created_at: NINE_O_CLOCK + secondsAfterNine, message, level }
    })
    expect((await ingest(device, { logs })).status).toBe(204)
  }

  async function read(device: Device, query = ''): Promise<DeviceLogPage> {
    const response = await http.request(`/api/devices/${device.id}/logs${query}`)
    expect(response.status).toBe(200)
    return response.json()
  }

  const messagesOf = (page: DeviceLogPage) => page.entries.map(entry => entry.message)

  describe('the ingest, POST /api/log', () => {
    it('answers 204 with no body and stores the level and the message of an entry in the current format', async () => {
      const response = await ingest(kitchen, { logs: [{ id: 7, created_at: NINE_O_CLOCK, message: 'OTA aborted', level: 'fatal', source_path: 'src/ota.cpp', source_line: 12 }] })

      expect(response.status).toBe(204)
      expect(await response.text()).toBe('')
      const [stored] = await database.getRepository(LogEntry).find()
      expect(stored).toMatchObject({ level: 'error', message: 'OTA aborted', logId: 7 })
      expect(JSON.parse(stored.entry)).toEqual({ id: 7, created_at: NINE_O_CLOCK, message: 'OTA aborted', level: 'fatal', source_path: 'src/ota.cpp', source_line: 12 })
    })

    it('stores the level and the message of an entry in the legacy format', async () => {
      const response = await ingest(kitchen, { log: { logs_array: [
        { log_id: 1, creation_timestamp: NINE_O_CLOCK, log_message: 'wifi connect failed' },
        { log_id: 2, creation_timestamp: NINE_O_CLOCK + 1, log_message: 'display poll' },
      ] } })

      expect(response.status).toBe(204)
      const stored = await database.getRepository(LogEntry).find({ order: { logId: 'ASC' } })
      expect(stored.map(({ level, message }) => ({ level, message }))).toEqual([
        { level: 'error', message: 'wifi connect failed' },
        { level: 'info', message: 'display poll' },
      ])
    })

    it('answers an unknown Device as before, in Nest\'s own body', async () => {
      const response = await http.postJson('/api/log', { logs: [{ id: 1 }] }, { headers: { id: 'FF:FF:FF:FF:FF:FF' } })

      expect(response.status).toBe(404)
      expect(await response.json()).toEqual({ statusCode: 404, message: 'Device not found', error: 'Not Found' })
    })
  })

  describe('the read, GET /api/devices/:id/logs', () => {
    it('answers the entries of one Device newest first, as parsed entries', async () => {
      await ingest(kitchen, { logs: [
        { id: 1, created_at: NINE_O_CLOCK, message: 'display poll', level: 'info' },
        { id: 2, created_at: NINE_O_CLOCK + 60, message: 'image download failed', level: 'error', source_path: 'src/display.cpp', source_line: 171, wifi_signal: -61, battery_voltage: 3.42, firmware_version: '1.6.8', retry: 1 },
      ] })
      await report(bedroom, ['bedroom boot'])

      const page = await read(kitchen)

      expect(page).toEqual({
        entries: [
          {
            id: expect.any(String),
            at: '2026-09-30T09:01:00.000Z',
            level: 'error',
            message: 'image download failed',
            source: { file: 'src/display.cpp', line: 171 },
            status: { wifiRssi: -61, wifiStatus: null, batteryVoltage: 3.42, freeHeapSize: null, wakeReason: null },
            firmwareVersion: '1.6.8',
            extras: { retry: 1 },
          },
          {
            id: expect.any(String),
            at: '2026-09-30T09:00:00.000Z',
            level: 'info',
            message: 'display poll',
            source: null,
            status: null,
            firmwareVersion: null,
            extras: {},
          },
        ],
        total: 2,
        matching: 2,
        nextCursor: null,
        newestCursor: expect.any(String),
      })
    })

    it('answers an empty Device Log with no cursor', async () => {
      expect(await read(kitchen)).toEqual({ entries: [], total: 0, matching: 0, nextCursor: null, newestCursor: null })
    })

    it('answers 50 entries when no limit is given', async () => {
      await report(kitchen, Array.from({ length: 52 }, (_, index) => `poll ${index}`))

      const page = await read(kitchen)

      expect(page.entries).toHaveLength(50)
      expect(page.total).toBe(52)
      expect(page.nextCursor).not.toBeNull()
    })

    it('pages by nextCursor without repeating or missing an entry, when entries share a time and new ones arrive in between', async () => {
      await report(kitchen, ['a', 'b', 'c', 'd', 'e'].map(message => ({ message, secondsAfterNine: 0 })))

      const first = await read(kitchen, '?limit=2')
      await report(kitchen, [{ message: 'arrived later', secondsAfterNine: 30 }, { message: 'arrived at the same time', secondsAfterNine: 0 }], 10)
      const pages = [first]
      while (pages[pages.length - 1].nextCursor !== null)
        pages.push(await read(kitchen, `?limit=2&before=${pages[pages.length - 1].nextCursor}`))

      const paged = pages.flatMap(messagesOf)
      expect(new Set(paged).size).toBe(paged.length)
      expect(paged.filter(message => message.length === 1).sort()).toEqual(['a', 'b', 'c', 'd', 'e'])
      expect(paged).not.toContain('arrived later')
      expect(pages.length).toBeGreaterThanOrEqual(3)
    })

    it('combines level=problems with q, whatever the case, and counts what matches over the whole Device Log', async () => {
      await report(kitchen, [
        { message: 'WiFi reconnect took 9 s', level: 'warn' },
        { message: 'wifi connected', level: 'info' },
        { message: 'wifi connect failed', level: 'error' },
        { message: 'image download failed', level: 'error' },
        { message: 'Wifi lost', level: 'fatal' },
      ])

      const page = await read(kitchen, '?level=problems&q=wIfI&limit=2')

      expect(messagesOf(page)).toEqual(['Wifi lost', 'wifi connect failed'])
      expect(page.total).toBe(5)
      expect(page.matching).toBe(3)
      expect(page.nextCursor).not.toBeNull()
    })

    it('matches q as text, not as a pattern', async () => {
      await report(kitchen, ['battery at 100%', 'battery at 100 mV', 'path a_b', 'path axb'])

      expect(messagesOf(await read(kitchen, `?q=${encodeURIComponent('100%')}`))).toEqual(['battery at 100%'])
      expect(messagesOf(await read(kitchen, '?q=a_b'))).toEqual(['path a_b'])
    })

    it('answers only the counts of what arrived since a cursor for after with limit=0', async () => {
      await report(kitchen, ['first', 'second'])
      const opened = await read(kitchen)

      await report(kitchen, [{ message: 'third', level: 'info', secondsAfterNine: 10 }, { message: 'fourth failed', level: 'error', secondsAfterNine: 11 }], 10)

      const since = await read(kitchen, `?after=${opened.newestCursor}&limit=0`)
      expect(since).toEqual({ entries: [], total: 4, matching: 2, nextCursor: null, newestCursor: expect.any(String) })
      expect(since.newestCursor).not.toBe(opened.newestCursor)
      expect((await read(kitchen, `?after=${opened.newestCursor}&limit=0&level=problems`)).matching).toBe(1)
      expect((await read(kitchen, `?after=${since.newestCursor}&limit=0`)).matching).toBe(0)
    })

    it('answers the entries that arrived since a cursor for after', async () => {
      await report(kitchen, ['first', 'second'])
      const opened = await read(kitchen)
      await report(kitchen, [{ message: 'third', secondsAfterNine: 10 }, { message: 'fourth', secondsAfterNine: 11 }], 10)

      expect(messagesOf(await read(kitchen, `?after=${opened.newestCursor}`))).toEqual(['fourth', 'third'])
    })

    it.each([
      ['a limit over 200', '?limit=201', 'limit'],
      ['a limit that is no whole number', '?limit=ten', 'limit'],
      ['a q of one character', '?q=w', 'q'],
      ['an unknown level', '?level=errors', 'level'],
      ['a cursor it never answered', '?before=nonsense', 'before'],
      ['an after cursor it never answered', '?after=nonsense', 'after'],
    ])('refuses %s with 400', async (_what, query, path) => {
      const response = await http.request(`/api/devices/${kitchen.id}/logs${query}`)

      expect(response.status).toBe(400)
      const refusal = await response.json()
      expect(refusal.code).toBe('validation')
      expect(new Set(refusal.fields.map((field: { path: string }) => field.path))).toEqual(new Set([path]))
    })

    it.each([UNKNOWN_ID, 'not-a-uuid'])('answers 404 device-not-found for the unknown Device %s', async (id) => {
      const response = await http.request(`/api/devices/${id}/logs`)

      expect(response.status).toBe(404)
      expect(await response.json()).toMatchObject({ code: 'device-not-found' })
    })
  })

  describe('the clearing, DELETE /api/devices/:id/logs', () => {
    it('answers 204 and removes every entry of that Device alone', async () => {
      await report(kitchen, ['one', 'two'])
      await report(bedroom, ['bedroom boot'])

      const response = await http.request(`/api/devices/${kitchen.id}/logs`, { method: 'DELETE' })

      expect(response.status).toBe(204)
      expect((await read(kitchen)).total).toBe(0)
      expect((await read(bedroom)).total).toBe(1)
    })

    it('answers 404 device-not-found for an unknown Device', async () => {
      const response = await http.request(`/api/devices/${UNKNOWN_ID}/logs`, { method: 'DELETE' })

      expect(response.status).toBe(404)
      expect(await response.json()).toMatchObject({ code: 'device-not-found' })
    })
  })

  it('no longer answers under /api/log/device', async () => {
    expect((await http.request(`/api/log/device/${kitchen.id}`)).status).toBe(404)
    expect((await http.request(`/api/log/device/${kitchen.id}`, { method: 'DELETE' })).status).toBe(404)
  })
})
