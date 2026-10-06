import type { ConfigService } from '@nestjs/config'
import type { ApiError, FirmwareList, FirmwareRead, FirmwareSyncResult } from 'kuroshiro-shared'
import type { DataSource } from 'typeorm'
import type { InstanceSettingsService } from '../../settings/instance-settings.service.js'
import type { HttpTestApp } from '../../test/httpApp.js'
import * as fs from 'node:fs'
import { getRepositoryToken } from '@nestjs/typeorm'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { DeviceModel } from '../../device-models/entities/device-model.entity.js'
import { Device } from '../../devices/devices.entity.js'
import { SyncRun } from '../../sync-runs/entities/sync-run.entity.js'
import { SyncRunService } from '../../sync-runs/sync-run.service.js'
import { jsonResponse, stubFetch } from '../../test/fetch.js'
import { createHttpTestApp } from '../../test/httpApp.js'
import { asService } from '../../test/mockService.js'
import { createTestDatabase } from '../../test/testDatabase.js'
import { UPLOAD_LIMITS } from '../../uploads/upload-limits.js'
import { Firmware } from '../entities/firmware.entity.js'
import { FirmwareAutoUpdateService } from '../firmware-auto-update.service.js'
import { FirmwareReadsService } from '../firmware-reads.service.js'
import { FirmwareSyncService } from '../firmware-sync.service.js'
import { FirmwareController } from '../firmware.controller.js'
import { FirmwareService } from '../firmware.service.js'

const { firmwareDirectory } = vi.hoisted(() => ({ firmwareDirectory: `${process.env.TMPDIR ?? '/tmp'}/kuroshiro-firmware-spec-${process.pid}` }))

vi.mock('../firmware-paths.js', () => ({
  firmwareFilePath: (id: string) => `${firmwareDirectory}/${id}.bin`,
  firmwareFileUrl: (id: string, apiUrl: string) => `${apiUrl}/firmware/${id}.bin`,
}))

vi.mock('node-cron', () => ({ default: { schedule: vi.fn() } }))

const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000'
const ISO_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
const LATEST = { url: 'https://trmnl-fw.example.com/FW1.6.0.bin', version: '1.6.0' }

const realFetch = globalThis.fetch
const mockFetch = stubFetch()

function trmnlAnswers(answer: (url: string) => Response | Promise<Response>): void {
  mockFetch.mockImplementation(async (input, init) =>
    String(input).startsWith('http://127.0.0.1') ? realFetch(input, init) : answer(String(input)))
}

function newestAnswer(): (url: string) => Response {
  return url => url.endsWith('/firmware/latest') ? jsonResponse(LATEST) : new Response(new Uint8Array([1, 2, 3]))
}

describe('the Firmware reads and writes, against a real database', () => {
  let database: DataSource
  let http: HttpTestApp
  let firmwareService: FirmwareService
  let autoUpdate = false
  let deviceCount = 0

  beforeAll(async () => {
    fs.mkdirSync(firmwareDirectory, { recursive: true })
    database = await createTestDatabase()
    const firmwareRepository = database.getRepository(Firmware)
    const syncRuns = new SyncRunService(database.getRepository(SyncRun))
    firmwareService = new FirmwareService(firmwareRepository, database.getRepository(DeviceModel), asService<ConfigService>({ get: () => 'http://kuroshiro.example' }))
    const reads = new FirmwareReadsService(database.getRepository(Device), firmwareService, syncRuns)
    const autoUpdateService = new FirmwareAutoUpdateService(
      database.getRepository(Device),
      asService<InstanceSettingsService>({ resolveFirmwareAutoUpdate: async () => autoUpdate }),
    )
    const syncService = new FirmwareSyncService(firmwareRepository, autoUpdateService, syncRuns)
    syncService.onApplicationBootstrap = async () => {}

    http = await createHttpTestApp({
      controllers: [FirmwareController],
      providers: [
        { provide: FirmwareService, useValue: firmwareService },
        { provide: FirmwareReadsService, useValue: reads },
        { provide: FirmwareSyncService, useValue: syncService },
        { provide: getRepositoryToken(Firmware), useValue: firmwareRepository },
      ],
    })
  }, 120_000)

  beforeEach(async () => {
    autoUpdate = false
    await database.query(`TRUNCATE "device", "firmware", "device_model", "sync_run" CASCADE`)
    fs.rmSync(firmwareDirectory, { recursive: true, force: true })
    fs.mkdirSync(firmwareDirectory, { recursive: true })
    await database.getRepository(DeviceModel).save({
      name: 'og_plus',
      label: 'TRMNL OG',
      width: 800,
      height: 480,
      colors: 4,
      bitDepth: 2,
      scaleFactor: 1,
      kind: 'trmnl',
    })
    trmnlAnswers(newestAnswer())
  })

  afterAll(async () => {
    await http.app.close()
    await database.destroy()
    fs.rmSync(firmwareDirectory, { recursive: true, force: true })
  })

  async function addDevice(overrides: Partial<Device> = {}): Promise<Device> {
    deviceCount += 1
    return database.getRepository(Device).save({
      name: `Device ${deviceCount}`,
      friendlyId: `FRIEND${deviceCount}`,
      mac: `AA:BB:CC:DD:EE:${String(deviceCount).padStart(2, '0')}`,
      apikey: `key-${deviceCount}`,
      deviceModel: { name: 'og_plus' },
      ...overrides,
    } as Device)
  }

  async function addFirmware(overrides: Partial<Firmware> = {}): Promise<Firmware> {
    const firmware = await database.getRepository(Firmware).save({
      version: '1.5.0',
      kind: 'official-synced',
      checksum: 'sum',
      compatibleModels: ['og_plus'],
      deprecated: false,
      syncedAt: new Date('2026-09-01T00:00:00.000Z'),
      ...overrides,
    })
    fs.writeFileSync(`${firmwareDirectory}/${firmware.id}.bin`, 'binary')
    return firmware
  }

  async function list(): Promise<FirmwareList> {
    return (await http.request('/api/firmware')).json()
  }

  async function sync(): Promise<Response> {
    return http.request('/api/firmware/sync', { method: 'POST' })
  }

  function uploadForm(fields: Record<string, string>, file: { name: string, bytes: Uint8Array<ArrayBuffer> } | null = { name: 'custom.bin', bytes: new Uint8Array([9, 9]) }): FormData {
    const form = new FormData()
    Object.entries(fields).forEach(([key, value]) => form.append(key, value))
    if (file)
      form.append('file', new Blob([file.bytes]), file.name)
    return form
  }

  async function upload(form: FormData): Promise<Response> {
    return http.request('/api/firmware/upload', { method: 'POST', body: form })
  }

  async function firmwareRows(): Promise<number> {
    return database.getRepository(Firmware).count()
  }

  describe('the sync record', () => {
    it('says there was no sync before the first one', async () => {
      expect((await list()).lastSync).toBeNull()
    })

    it('moves with a sync that found nothing new', async () => {
      await sync()
      const first = (await list()).lastSync!
      await new Promise(resolve => setTimeout(resolve, 5))

      const response = await sync()
      const second = (await list()).lastSync!

      expect(await response.json()).toMatchObject({ inserted: false, version: '1.6.0', assigned: [] })
      expect(second).toEqual({ ranAt: expect.stringMatching(ISO_TIME), ok: true, error: null })
      expect(second.ranAt > first.ranAt).toBe(true)
    })

    it('records a failed sync with the reason, and the request answers 502 upstream-unreachable', async () => {
      await sync()
      trmnlAnswers(() => jsonResponse(null, { status: 502 }))

      const response = await sync()
      const body: ApiError = await response.json()

      expect(response.status).toBe(502)
      expect(body).toMatchObject({ statusCode: 502, code: 'upstream-unreachable', details: { reason: expect.stringContaining('502') } })
      expect((await list()).lastSync).toEqual({ ranAt: expect.stringMatching(ISO_TIME), ok: false, error: expect.stringContaining('502') })
    })

    it('is written by a sync that no request asked for, as the daily job and the sync at start run it', async () => {
      const syncService = http.app.get(FirmwareSyncService)
      await syncService.sync()
      expect((await list()).lastSync).toMatchObject({ ok: true })
    })
  })

  describe('syncing', () => {
    it('answers the time, the version and no Device while Firmware Auto-Update is off', async () => {
      await addDevice()

      const response = await sync()

      expect(response.status).toBe(201)
      expect(await response.json()).toEqual({ ranAt: expect.stringMatching(ISO_TIME), inserted: true, version: '1.6.0', assigned: [] })
    })

    it('names the Devices Firmware Auto-Update gave the new Firmware to', async () => {
      autoUpdate = true
      const device = await addDevice({ name: 'Hallway' })
      await addDevice({ name: 'Already pending', updateFirmware: true })

      const result: FirmwareSyncResult = await (await sync()).json()

      expect(result.assigned).toEqual([{ id: device.id, name: 'Hallway' }])
    })

    it('inserts nothing when a custom Firmware already holds the version, not just the newest official one', async () => {
      await addFirmware({ kind: 'custom', version: '1.6.0', uploadedAt: new Date(), syncedAt: null })

      const result: FirmwareSyncResult = await (await sync()).json()

      expect(result).toMatchObject({ inserted: false, version: '1.6.0' })
      expect(await firmwareRows()).toBe(1)
    })
  })

  describe('listing', () => {
    it('answers newest first, with the Devices that target and run each Firmware', async () => {
      const older = await addFirmware({ version: '1.5.0', deprecated: true })
      const newer = await addFirmware({ version: '1.6.0', syncedAt: new Date('2026-09-20T00:00:00.000Z') })
      const target = await addDevice({ name: 'Pending', targetFirmware: newer, updateFirmware: true })
      const settled = await addDevice({ name: 'Settled', targetFirmware: newer, updateFirmware: false, fwVersion: '1.6.0' })
      const runner = await addDevice({ name: 'Runner', fwVersion: '1.5.0' })

      const { firmware }: FirmwareList = await list()

      expect(firmware.map(row => row.id)).toEqual([newer.id, older.id])
      expect(firmware[0]).toEqual({
        id: newer.id,
        version: '1.6.0',
        kind: 'official-synced',
        label: null,
        compatibleModels: ['og_plus'],
        deprecated: false,
        syncedAt: '2026-09-20T00:00:00.000Z',
        uploadedAt: null,
        filePresent: true,
        targetOf: expect.arrayContaining([{ id: target.id, name: 'Pending', pushPending: true }, { id: settled.id, name: 'Settled', pushPending: false }]),
        runningOn: [{ id: settled.id, name: 'Settled' }],
      })
      expect(firmware[0].targetOf).toHaveLength(2)
      expect(firmware[1]).toMatchObject({ targetOf: [], runningOn: [{ id: runner.id, name: 'Runner' }] })
    })

    it('says a Firmware whose binary is gone has no file present', async () => {
      const custom = await addFirmware({ kind: 'custom', version: 'mine', uploadedAt: new Date(), syncedAt: null })
      fs.rmSync(`${firmwareDirectory}/${custom.id}.bin`)

      const { firmware }: FirmwareList = await list()

      expect(firmware[0]).toMatchObject({ kind: 'custom', filePresent: false })
    })
  })

  describe('uploading', () => {
    it('answers 201 with the Firmware as a read model and stores its file', async () => {
      const response = await upload(uploadForm({ version: '2.0.0-mine', label: 'Mine', compatibleModels: '["og_plus"]' }))
      const body: FirmwareRead = await response.json()

      expect(response.status).toBe(201)
      expect(body).toEqual({
        id: expect.any(String),
        version: '2.0.0-mine',
        kind: 'custom',
        label: 'Mine',
        compatibleModels: ['og_plus'],
        deprecated: false,
        syncedAt: null,
        uploadedAt: expect.stringMatching(ISO_TIME),
        filePresent: true,
        targetOf: [],
        runningOn: [],
      })
      expect(fs.existsSync(`${firmwareDirectory}/${body.id}.bin`)).toBe(true)
    })

    it('takes any Device Model when none is named', async () => {
      const body: FirmwareRead = await (await upload(uploadForm({ version: '2.0.0' }))).json()
      expect(body).toMatchObject({ compatibleModels: [], label: 'custom.bin' })
    })

    it('refuses a version that exists with 409 firmware-version-taken, and stores nothing', async () => {
      await addFirmware({ version: '1.5.0' })

      const response = await upload(uploadForm({ version: '1.5.0' }))

      expect(response.status).toBe(409)
      expect(await response.json()).toMatchObject({ code: 'firmware-version-taken', details: { version: '1.5.0' } })
      expect(await firmwareRows()).toBe(1)
      expect(fs.readdirSync(firmwareDirectory)).toHaveLength(1)
    })

    it('refuses with 409 firmware-version-taken, and stores nothing, when another upload wins a race the up-front check missed', async () => {
      const assertVersionFree = vi.spyOn(firmwareService as unknown as { assertVersionFree: (version: string) => Promise<void> }, 'assertVersionFree')
      assertVersionFree.mockImplementationOnce(async () => {
        // The other request's write, landing between this one's check and its own write.
        await addFirmware({ version: '1.5.0' })
      })

      const response = await upload(uploadForm({ version: '1.5.0' }))

      expect(response.status).toBe(409)
      expect(await response.json()).toMatchObject({ code: 'firmware-version-taken', details: { version: '1.5.0' } })
      expect(await firmwareRows()).toBe(1)
      expect(fs.readdirSync(firmwareDirectory)).toHaveLength(1)
      assertVersionFree.mockRestore()
    })

    it('refuses a Device Model the Instance does not know with 400 device-model-unknown, and stores nothing', async () => {
      const response = await upload(uploadForm({ version: '2.0.0', compatibleModels: '["og_plus","imaginary"]' }))

      expect(response.status).toBe(400)
      expect(await response.json()).toMatchObject({ code: 'device-model-unknown', details: { names: ['imaginary'] } })
      expect(await firmwareRows()).toBe(0)
      expect(fs.readdirSync(firmwareDirectory)).toHaveLength(0)
    })

    it('refuses a file over the limit with 413 upload-too-large and the limit, and stores nothing', async () => {
      const response = await upload(uploadForm({ version: '2.0.0' }, { name: 'big.bin', bytes: new Uint8Array(UPLOAD_LIMITS.firmwareUploadBytes + 1) }))

      expect(response.status).toBe(413)
      expect(await response.json()).toMatchObject({ code: 'upload-too-large', details: { limitBytes: UPLOAD_LIMITS.firmwareUploadBytes } })
      expect(await firmwareRows()).toBe(0)
      expect(fs.readdirSync(firmwareDirectory)).toHaveLength(0)
    })

    it('refuses a file that is not a .bin with 400', async () => {
      const response = await upload(uploadForm({ version: '2.0.0' }, { name: 'fw.zip', bytes: new Uint8Array([1]) }))

      expect(response.status).toBe(400)
      expect(await firmwareRows()).toBe(0)
    })

    it('refuses a missing version and a missing file with 400', async () => {
      const withoutVersion = await upload(uploadForm({}))
      const withoutFile = await upload(uploadForm({ version: '2.0.0' }, null))

      expect(withoutVersion.status).toBe(400)
      expect(await withoutVersion.json()).toMatchObject({ code: 'validation', fields: expect.arrayContaining([{ path: 'version', message: expect.any(String) }]) })
      expect(withoutFile.status).toBe(400)
    })

    it('refuses a Device Model list that is not a list of names with a field error', async () => {
      const response = await upload(uploadForm({ version: '2.0.0', compatibleModels: 'og_plus' }))

      expect(response.status).toBe(400)
      expect(await response.json()).toMatchObject({ code: 'validation', fields: [{ path: 'compatibleModels' }] })
    })
  })

  describe('deleting', () => {
    it('answers 204, and leaves a Device with a push pending with no target and no push', async () => {
      const custom = await addFirmware({ kind: 'custom', version: 'mine', uploadedAt: new Date(), syncedAt: null })
      const device = await addDevice({ targetFirmware: custom, updateFirmware: true })

      const response = await http.request(`/api/firmware/${custom.id}`, { method: 'DELETE' })

      expect(response.status).toBe(204)
      const after = await database.getRepository(Device).findOneByOrFail({ id: device.id })
      expect(after.targetFirmware).toBeNull()
      expect(after.updateFirmware).toBe(false)
      expect(await firmwareRows()).toBe(0)
      expect(fs.existsSync(`${firmwareDirectory}/${custom.id}.bin`)).toBe(false)
    })

    it('lets Firmware Auto-Update give the next official Firmware to that Device', async () => {
      autoUpdate = true
      const custom = await addFirmware({ kind: 'custom', version: 'mine', uploadedAt: new Date(), syncedAt: null })
      const device = await addDevice({ targetFirmware: custom, updateFirmware: true })
      await http.request(`/api/firmware/${custom.id}`, { method: 'DELETE' })

      const result: FirmwareSyncResult = await (await sync()).json()

      expect(result.assigned).toEqual([{ id: device.id, name: device.name }])
    })

    it('answers 400 firmware-not-custom for an official Firmware, and keeps it', async () => {
      const official = await addFirmware()

      const response = await http.request(`/api/firmware/${official.id}`, { method: 'DELETE' })

      expect(response.status).toBe(400)
      expect(await response.json()).toMatchObject({ code: 'firmware-not-custom' })
      expect(await firmwareRows()).toBe(1)
    })

    it('answers 404 for an unknown id', async () => {
      const response = await http.request(`/api/firmware/${UNKNOWN_ID}`, { method: 'DELETE' })

      expect(response.status).toBe(404)
      expect(await response.json()).toMatchObject({ code: 'not-found' })
    })
  })
})
