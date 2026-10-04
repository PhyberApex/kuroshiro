import type { DeviceModelList, DeviceModelSyncResult, PaletteRead } from 'kuroshiro-shared'
import type { DataSource } from 'typeorm'
import type { HttpTestApp } from '../../test/httpApp.js'
import { getRepositoryToken } from '@nestjs/typeorm'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { Device } from '../../devices/devices.entity.js'
import { SyncRun } from '../../sync-runs/entities/sync-run.entity.js'
import { SyncRunService } from '../../sync-runs/sync-run.service.js'
import { jsonResponse, stubFetch } from '../../test/fetch.js'
import { createHttpTestApp } from '../../test/httpApp.js'
import { createTestDatabase } from '../../test/testDatabase.js'
import { DeviceModelReadsService } from '../device-model-reads.service.js'
import { DeviceModelSyncService } from '../device-model-sync.service.js'
import { DeviceModelsController } from '../device-models.controller.js'
import { DeviceModelsService } from '../device-models.service.js'
import { DeviceModel } from '../entities/device-model.entity.js'
import { Palette } from '../entities/palette.entity.js'

vi.mock('node-cron', () => ({ default: { schedule: vi.fn() } }))

const realFetch = globalThis.fetch
const mockFetch = stubFetch()

function trmnlAnswers(answer: (url: string) => Response): void {
  mockFetch.mockImplementation(async (input, init) =>
    String(input).startsWith('http://127.0.0.1') ? realFetch(input, init) : answer(String(input)))
}

const MODEL_BASE = { width: 800, height: 480, colors: 4, bitDepth: 2, scaleFactor: 1, kind: 'trmnl' }
const RED_FAMILY = 'screen--color-3bwr'
const YELLOW_FAMILY = 'screen--color-3bwy'

describe('the Device Model and Palette reads, against a real database', () => {
  let database: DataSource
  let http: HttpTestApp
  let deviceCount = 0

  beforeAll(async () => {
    database = await createTestDatabase()
    const deviceModels = new DeviceModelsService(database.getRepository(DeviceModel), database.getRepository(Palette))
    const syncRuns = new SyncRunService(database.getRepository(SyncRun))
    const reads = new DeviceModelReadsService(database.getRepository(Device), deviceModels, syncRuns)
    const syncService = new DeviceModelSyncService(database.getRepository(DeviceModel), database.getRepository(Palette), syncRuns)
    syncService.onApplicationBootstrap = async () => {}

    http = await createHttpTestApp({
      controllers: [DeviceModelsController],
      providers: [
        { provide: DeviceModelReadsService, useValue: reads },
        { provide: DeviceModelSyncService, useValue: syncService },
        { provide: getRepositoryToken(Device), useValue: database.getRepository(Device) },
      ],
    })
  }, 120_000)

  beforeEach(async () => {
    await database.query(`TRUNCATE "device", "device_model", "palette", "sync_run" CASCADE`)
    await database.getRepository(Palette).save([
      { id: 'bw', name: 'Black & White', kind: 'official', grays: 2, frameworkClass: 'screen--1bit' },
      { id: 'red', name: 'Red', kind: 'official', grays: 2, colors: ['#000000', '#FF0000', '#FFFFFF'], frameworkClass: RED_FAMILY },
      { id: 'custom-red', name: 'My Red', kind: 'custom', grays: 2, colors: ['#ff0000', '#ffffff', '#000000'], frameworkClass: RED_FAMILY },
      { id: 'custom-yellow', name: 'My Yellow', kind: 'custom', grays: 2, colors: ['#ffff00', '#ffffff', '#000000'], frameworkClass: YELLOW_FAMILY },
    ])
    await database.getRepository(DeviceModel).save([
      { ...MODEL_BASE, name: 'og_bwr', label: 'OG red', paletteIds: ['red', 'bw'] },
      { ...MODEL_BASE, name: 'og_png', label: 'OG 1-bit', paletteIds: ['bw'] },
    ])
    trmnlAnswers(() => jsonResponse({ data: [] }))
  })

  afterAll(async () => {
    await http.app.close()
    await database.destroy()
  })

  async function addDevice(name: string, overrides: Partial<Device> = {}): Promise<Device> {
    deviceCount += 1
    return database.getRepository(Device).save({
      name,
      friendlyId: `FRIEND${deviceCount}`,
      mac: `AA:BB:CC:DD:EE:${String(deviceCount).padStart(2, '0')}`,
      apikey: `key-${deviceCount}`,
      deviceModel: { name: 'og_bwr' },
      ...overrides,
    } as Device)
  }

  async function models(): Promise<DeviceModelList> {
    return (await http.request('/api/device-models')).json()
  }

  async function palettes(): Promise<PaletteRead[]> {
    return (await http.request('/api/device-models/palettes')).json()
  }

  function sync(): Promise<Response> {
    return http.request('/api/device-models/sync', { method: 'POST' })
  }

  describe('gET /api/device-models', () => {
    it('widens paletteIds with the custom Palettes of a compatible Palette Family and none of another', async () => {
      const { models: list } = await models()

      expect(list.find(m => m.name === 'og_bwr')?.paletteIds).toEqual(['red', 'bw', 'custom-red'])
      expect(list.find(m => m.name === 'og_png')?.paletteIds).toEqual(['bw'])
    })

    it('accepts a Device save with every Palette it lists for the Device Model', async () => {
      const { models: list } = await models()
      const deviceModels = new DeviceModelsService(database.getRepository(DeviceModel), database.getRepository(Palette))
      const model = (await deviceModels.findByName('og_bwr'))!

      for (const id of list.find(m => m.name === 'og_bwr')!.paletteIds)
        await expect(deviceModels.supportsPalette(model, (await deviceModels.findPalette(id))!)).resolves.toBe(true)
      await expect(deviceModels.supportsPalette(model, (await deviceModels.findPalette('custom-yellow'))!)).resolves.toBe(false)
    })

    it('names the Devices on each Device Model, ordered by name ignoring case', async () => {
      await addDevice('kitchen')
      await addDevice('Attic')
      await addDevice('Cellar', { deviceModel: { name: 'og_png' } as DeviceModel })

      const { models: list } = await models()

      expect(list.find(m => m.name === 'og_bwr')?.usedBy.map(d => d.name)).toEqual(['Attic', 'kitchen'])
      expect(list.find(m => m.name === 'og_png')?.usedBy.map(d => d.name)).toEqual(['Cellar'])
    })

    it('names each Device Model\'s default Palette: the richest of TRMNL\'s curated ones, never a custom one', async () => {
      const { models: list } = await models()

      expect(list.map(model => [model.name, model.defaultPaletteId])).toEqual([['og_png', 'bw'], ['og_bwr', 'red']])
    })

    it('answers no last sync before the first one', async () => {
      expect((await models()).lastSync).toBeNull()
    })
  })

  describe('gET /api/device-models/palettes', () => {
    it('names the Devices on one of TRMNL\'s Palettes and on a custom Palette', async () => {
      await addDevice('Official', { palette: { id: 'red' } as Palette })
      await addDevice('Custom', { palette: { id: 'custom-red' } as Palette })

      const list = await palettes()

      expect(list.find(p => p.id === 'red')?.usedBy.map(d => d.name)).toEqual(['Official'])
      expect(list.find(p => p.id === 'custom-red')?.usedBy.map(d => d.name)).toEqual(['Custom'])
      expect(list.find(p => p.id === 'bw')?.usedBy).toEqual([])
    })

    it('answers every key of a Palette, with absent colours as null', async () => {
      const bw = (await palettes()).find(p => p.id === 'bw')

      expect(bw).toEqual({ id: 'bw', name: 'Black & White', kind: 'official', grays: 2, colors: null, frameworkClass: 'screen--1bit', grayscaleBitDepth: null, deprecated: false, syncedAt: null, usedBy: [] })
    })
  })

  describe('pOST /api/device-models/sync', () => {
    it('answers ranAt and today\'s counts, and moves lastSync with ok: true', async () => {
      const response = await sync()
      const result: DeviceModelSyncResult = await response.json()

      expect(response.status).toBe(201)
      expect(result).toEqual({ models: 0, palettes: 0, deprecatedModels: 2, deprecatedPalettes: 2, ranAt: expect.any(String) })
      expect((await models()).lastSync).toEqual({ ranAt: result.ranAt, ok: true, error: null })
    })

    it('answers 502 upstream-unreachable and moves lastSync with ok: false and the reason', async () => {
      trmnlAnswers(() => jsonResponse(null, { ok: false }))

      const response = await sync()

      expect(response.status).toBe(502)
      const body = await response.json()
      expect(body).toMatchObject({ code: 'upstream-unreachable', details: { reason: expect.stringMatching(/request failed/) } })
      expect((await models()).lastSync).toMatchObject({ ok: false, error: expect.stringMatching(/request failed/) })
    })
  })
})
