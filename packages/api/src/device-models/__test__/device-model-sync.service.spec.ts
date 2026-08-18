import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TRMNL_MODELS_SNAPSHOT, TRMNL_PALETTES_SNAPSHOT } from '../data/trmnl-snapshot'
import { DeviceModelSyncService } from '../device-model-sync.service'

const mockFetch = vi.fn()
globalThis.fetch = mockFetch

function createMockRepo() {
  return {
    find: vi.fn(),
    insert: vi.fn(),
    upsert: vi.fn(),
    update: vi.fn(),
  }
}

function jsonResponse(data: unknown, ok = true) {
  return { ok, status: ok ? 200 : 502, statusText: ok ? 'OK' : 'Bad Gateway', json: async () => ({ data }) }
}

const paletteA = { id: 'bw', name: 'Black & White (1-bit)', grays: 2, framework_class: 'screen--1bit' }
const paletteB = { id: 'gray-4', name: '4 Grays (2-bit)', grays: 4, framework_class: 'screen--2bit' }
const modelA = {
  name: 'og_plus',
  label: 'TRMNL OG (2-bit)',
  width: 800,
  height: 480,
  colors: 4,
  bit_depth: 2,
  scale_factor: 1,
  rotation: 0,
  mime_type: 'image/png',
  offset_x: 0,
  offset_y: 0,
  kind: 'trmnl',
  palette_ids: ['bw', 'gray-4'],
  css: { classes: { device: 'screen--og_plus', size: 'screen--md' }, variables: [['--screen-w', '800px'], ['--screen-h', '480px']] },
}

describe('deviceModelSyncService', () => {
  let service: DeviceModelSyncService
  let modelRepo: ReturnType<typeof createMockRepo>
  let paletteRepo: ReturnType<typeof createMockRepo>

  beforeEach(() => {
    vi.resetAllMocks()
    modelRepo = createMockRepo()
    paletteRepo = createMockRepo()
    service = new DeviceModelSyncService(modelRepo as any, paletteRepo as any)
  })

  describe('seedFromSnapshot', () => {
    it('inserts every snapshot row into empty tables', async () => {
      modelRepo.find.mockResolvedValue([])
      paletteRepo.find.mockResolvedValue([])
      const result = await service.seedFromSnapshot()
      expect(result).toEqual({ models: TRMNL_MODELS_SNAPSHOT.length, palettes: TRMNL_PALETTES_SNAPSHOT.length })
      expect(paletteRepo.insert).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ id: 'bw', frameworkClass: 'screen--1bit' })]))
      expect(modelRepo.insert).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ name: 'og_plus', width: 800, height: 480 })]))
    })

    it('only inserts rows that are missing and never touches existing ones', async () => {
      modelRepo.find.mockResolvedValue(TRMNL_MODELS_SNAPSHOT.filter(m => m.name !== 'v2').map(m => ({ name: m.name })))
      paletteRepo.find.mockResolvedValue(TRMNL_PALETTES_SNAPSHOT.map(p => ({ id: p.id })))
      const result = await service.seedFromSnapshot()
      expect(result).toEqual({ models: 1, palettes: 0 })
      expect(paletteRepo.insert).not.toHaveBeenCalled()
      expect(modelRepo.insert).toHaveBeenCalledWith([expect.objectContaining({ name: 'v2' })])
      expect(modelRepo.upsert).not.toHaveBeenCalled()
      expect(modelRepo.update).not.toHaveBeenCalled()
    })
  })

  describe('sync', () => {
    it('upserts the live lists and deprecates rows that vanished upstream without deleting them', async () => {
      mockFetch.mockImplementation(async (url: string) =>
        url.endsWith('/palettes') ? jsonResponse([paletteA, paletteB]) : jsonResponse([modelA]))
      paletteRepo.find.mockResolvedValue([{ id: 'bw' }, { id: 'gray-4' }, { id: 'gray-16' }])
      modelRepo.find.mockResolvedValue([{ name: 'og_plus' }, { name: 'gone' }])

      const result = await service.sync()

      expect(mockFetch).toHaveBeenCalledWith('https://usetrmnl.com/api/palettes')
      expect(mockFetch).toHaveBeenCalledWith('https://usetrmnl.com/api/models')
      expect(paletteRepo.upsert).toHaveBeenCalledWith(
        [expect.objectContaining({ id: 'bw', deprecated: false }), expect.objectContaining({ id: 'gray-4', deprecated: false })],
        ['id'],
      )
      expect(modelRepo.upsert).toHaveBeenCalledWith(
        [expect.objectContaining({
          name: 'og_plus',
          bitDepth: 2,
          paletteIds: ['bw', 'gray-4'],
          cssClasses: ['screen--og_plus', 'screen--md'],
          cssVariables: { '--screen-w': '800px', '--screen-h': '480px' },
          deprecated: false,
        })],
        ['name'],
      )
      expect(paletteRepo.update).toHaveBeenCalledWith({ id: expect.anything() }, { deprecated: true })
      expect(modelRepo.update).toHaveBeenCalledWith({ name: expect.anything() }, { deprecated: true })
      expect(result).toMatchObject({ models: 1, palettes: 2, deprecatedModels: 1, deprecatedPalettes: 1 })
      expect(result.syncedAt).toBeInstanceOf(Date)
    })

    it('does not deprecate anything when the live list matches', async () => {
      mockFetch.mockImplementation(async (url: string) =>
        url.endsWith('/palettes') ? jsonResponse([paletteA]) : jsonResponse([modelA]))
      paletteRepo.find.mockResolvedValue([{ id: 'bw' }])
      modelRepo.find.mockResolvedValue([{ name: 'og_plus' }])
      const result = await service.sync()
      expect(paletteRepo.update).not.toHaveBeenCalled()
      expect(modelRepo.update).not.toHaveBeenCalled()
      expect(result).toMatchObject({ deprecatedModels: 0, deprecatedPalettes: 0 })
    })

    it('throws and writes nothing when TRMNL is unreachable', async () => {
      mockFetch.mockResolvedValue(jsonResponse(null, false))
      await expect(service.sync()).rejects.toThrow(/request failed/)
      expect(paletteRepo.upsert).not.toHaveBeenCalled()
      expect(modelRepo.upsert).not.toHaveBeenCalled()
    })

    it('throws when the response has no data array', async () => {
      mockFetch.mockResolvedValue({ ok: true, status: 200, statusText: 'OK', json: async () => ({ nope: [] }) })
      await expect(service.sync()).rejects.toThrow(/no data array/)
    })
  })
})
