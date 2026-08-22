import type { DeviceModel } from '../entities/device-model.entity'
import type { Palette } from '../entities/palette.entity'
import { Logger } from '@nestjs/common'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { jsonResponse, stubFetch } from '../../test/fetch'
import { makeDeviceModel, makePalette } from '../../test/fixtures'
import { asRepository, createMockRepository } from '../../test/mockRepository'
import { TRMNL_MODELS_SNAPSHOT, TRMNL_PALETTES_SNAPSHOT } from '../data/trmnl-snapshot'
import { DeviceModelSyncService } from '../device-model-sync.service'

const mockFetch = stubFetch()

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
  let modelRepo: ReturnType<typeof createMockRepository<DeviceModel>>
  let paletteRepo: ReturnType<typeof createMockRepository<Palette>>

  beforeEach(() => {
    vi.resetAllMocks()
    modelRepo = createMockRepository<DeviceModel>()
    paletteRepo = createMockRepository<Palette>()
    service = new DeviceModelSyncService(asRepository(modelRepo), asRepository(paletteRepo))
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
      modelRepo.find.mockResolvedValue(TRMNL_MODELS_SNAPSHOT.filter(m => m.name !== 'v2').map(m => makeDeviceModel({ name: m.name })))
      paletteRepo.find.mockResolvedValue(TRMNL_PALETTES_SNAPSHOT.map(p => makePalette({ id: p.id })))
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
      mockFetch.mockImplementation(async url =>
        url.toString().endsWith('/palettes') ? jsonResponse({ data: [paletteA, paletteB] }) : jsonResponse({ data: [modelA] }))
      paletteRepo.find.mockResolvedValue([makePalette({ id: 'bw' }), makePalette({ id: 'gray-4' }), makePalette({ id: 'gray-16' })])
      modelRepo.find.mockResolvedValue([makeDeviceModel({ name: 'og_plus' }), makeDeviceModel({ name: 'gone' })])

      const result = await service.sync()

      expect(mockFetch).toHaveBeenCalledWith('https://usetrmnl.com/api/palettes', { signal: expect.any(AbortSignal) })
      expect(mockFetch).toHaveBeenCalledWith('https://usetrmnl.com/api/models', { signal: expect.any(AbortSignal) })
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

    it('never upserts or deprecates a kind: custom palette, regardless of what upstream reports', async () => {
      mockFetch.mockImplementation(async url =>
        url.toString().endsWith('/palettes') ? jsonResponse({ data: [paletteA] }) : jsonResponse({ data: [modelA] }))
      paletteRepo.find.mockResolvedValue([makePalette({ id: 'bw' })])
      modelRepo.find.mockResolvedValue([makeDeviceModel({ name: 'og_plus' })])

      await service.sync()

      expect(paletteRepo.find).toHaveBeenCalledWith({ select: { id: true }, where: { deprecated: false, kind: 'official' } })
      expect(paletteRepo.upsert).toHaveBeenCalledWith(
        [expect.objectContaining({ id: 'bw', kind: 'official' })],
        ['id'],
      )
    })

    it('does not deprecate anything when the live list matches', async () => {
      mockFetch.mockImplementation(async url =>
        url.toString().endsWith('/palettes') ? jsonResponse({ data: [paletteA] }) : jsonResponse({ data: [modelA] }))
      paletteRepo.find.mockResolvedValue([makePalette({ id: 'bw' })])
      modelRepo.find.mockResolvedValue([makeDeviceModel({ name: 'og_plus' })])
      const result = await service.sync()
      expect(paletteRepo.update).not.toHaveBeenCalled()
      expect(modelRepo.update).not.toHaveBeenCalled()
      expect(result).toMatchObject({ deprecatedModels: 0, deprecatedPalettes: 0 })
    })

    it('throws and writes nothing when TRMNL is unreachable', async () => {
      mockFetch.mockImplementation(async () => jsonResponse(null, { ok: false }))
      await expect(service.sync()).rejects.toThrow(/request failed/)
      expect(paletteRepo.upsert).not.toHaveBeenCalled()
      expect(modelRepo.upsert).not.toHaveBeenCalled()
    })

    it('throws when the response has no data array', async () => {
      mockFetch.mockImplementation(async () => jsonResponse({ nope: [] }))
      await expect(service.sync()).rejects.toThrow(/no data array/)
    })

    it('surfaces a clear error when a fetch times out', async () => {
      mockFetch.mockImplementation(async () => {
        throw new DOMException('The operation was aborted due to timeout', 'TimeoutError')
      })
      await expect(service.sync()).rejects.toThrow(/request timed out/)
    })

    it('skips a palette with an invalid colour and logs it, without dropping other valid palettes', async () => {
      const warnSpy = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {})
      const badPalette = { ...paletteB, id: 'gray-8', colors: ['#zzzzzz'] }
      mockFetch.mockImplementation(async url =>
        url.toString().endsWith('/palettes') ? jsonResponse({ data: [paletteA, badPalette] }) : jsonResponse({ data: [modelA] }))
      paletteRepo.find.mockResolvedValue([])
      modelRepo.find.mockResolvedValue([])

      const result = await service.sync()

      expect(paletteRepo.upsert).toHaveBeenCalledWith([expect.objectContaining({ id: 'bw' })], ['id'])
      expect(result.palettes).toBe(1)
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Skipping invalid palette'))
      warnSpy.mockRestore()
    })

    it('skips a model with an invalid id and logs it, without dropping other valid models', async () => {
      const warnSpy = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {})
      const badModel = { ...modelA, name: '../evil' }
      mockFetch.mockImplementation(async url =>
        url.toString().endsWith('/palettes') ? jsonResponse({ data: [paletteA] }) : jsonResponse({ data: [modelA, badModel] }))
      paletteRepo.find.mockResolvedValue([])
      modelRepo.find.mockResolvedValue([])

      const result = await service.sync()

      expect(modelRepo.upsert).toHaveBeenCalledWith([expect.objectContaining({ name: 'og_plus' })], ['name'])
      expect(result.models).toBe(1)
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Skipping invalid model'))
      warnSpy.mockRestore()
    })

    it('coalesces concurrent sync() calls into a single run', async () => {
      mockFetch.mockImplementation(async url =>
        url.toString().endsWith('/palettes') ? jsonResponse({ data: [paletteA] }) : jsonResponse({ data: [modelA] }))
      paletteRepo.find.mockResolvedValue([])
      modelRepo.find.mockResolvedValue([])

      const [first, second] = await Promise.all([service.sync(), service.sync()])

      expect(mockFetch).toHaveBeenCalledTimes(2)
      expect(first).toBe(second)

      await service.sync()
      expect(mockFetch).toHaveBeenCalledTimes(4)
    })
  })
})
