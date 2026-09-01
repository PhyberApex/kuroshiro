import type { DeviceReport } from '../device-models.service.js'
import type { DeviceModel } from '../entities/device-model.entity.js'
import type { Palette } from '../entities/palette.entity.js'
import { beforeEach, describe, expect, it } from 'vitest'
import { BW, GRAY_4, GRAY_16, OG_PLUS, V2 } from '../../test/mockDeviceModelsService.js'
import { asRepository, createMockRepository } from '../../test/mockRepository.js'
import { DeviceModelsService } from '../device-models.service.js'

const SEEED_E1003 = { ...V2, name: 'seeed_e1003', label: 'reTerminal E1003', kind: 'byod' }
const COLOR_6A = { ...BW, id: 'color-6a', name: 'Color (6 colors)', grays: 2, colors: ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#000000', '#FFFFFF'], frameworkClass: 'screen--color-6a', grayscaleBitDepth: 1 }
const SEEED_E1002 = { ...OG_PLUS, name: 'seeed_e1002', label: 'reTerminal E1002', kind: 'byod', paletteIds: ['color-6a', 'bw'] }
const OG_BWRY = { ...OG_PLUS, name: 'og_bwry', label: 'TRMNL OG (colour)', kind: 'trmnl' }
const OG_PNG = { ...OG_PLUS, name: 'og_png', label: 'TRMNL OG (1-bit)', kind: 'trmnl' }
const ONYX_BOOX_NOVA_AIR_C = { ...V2, name: 'onxy_boox_nova_air_c', label: 'Onyx Boox Nova Air C', kind: 'byod' }

function firstWhere<T>(where: T | T[] | undefined): T | undefined {
  return Array.isArray(where) ? where[0] : where
}

describe('deviceModelsService', () => {
  let service: DeviceModelsService
  let modelRepo: ReturnType<typeof createMockRepository<DeviceModel>>
  let paletteRepo: ReturnType<typeof createMockRepository<Palette>>

  const models = [OG_PLUS, V2, SEEED_E1003, SEEED_E1002, OG_BWRY, OG_PNG, ONYX_BOOX_NOVA_AIR_C]
  const palettes = [BW, GRAY_4, GRAY_16, COLOR_6A]

  beforeEach(() => {
    modelRepo = createMockRepository<DeviceModel>()
    paletteRepo = createMockRepository<Palette>()
    modelRepo.findOneBy.mockImplementation(async (where) => {
      const w = firstWhere(where)
      return models.find(m => m.name === w?.name) ?? null
    })
    modelRepo.find.mockImplementation(async (options = {}) => {
      const where = firstWhere(options.where)
      return where ? models.filter(m => m.width === where.width && m.height === where.height && m.deprecated === where.deprecated) : models
    })
    paletteRepo.find.mockResolvedValue(palettes)
    paletteRepo.findOneBy.mockImplementation(async (where) => {
      const w = firstWhere(where)
      return palettes.find(p => p.id === w?.id) ?? null
    })
    service = new DeviceModelsService(asRepository(modelRepo), asRepository(paletteRepo))
  })

  describe('resolve', () => {
    it('maps firmware board names to their upstream model', async () => {
      await expect(service.resolve({ reportedModel: 'x' })).resolves.toBe(V2)
      await expect(service.resolve({ reportedModel: 'og' })).resolves.toBe(OG_PLUS)
      await expect(service.resolve({ reportedModel: 'reterminal_e1003' })).resolves.toBe(SEEED_E1003)
    })

    it('accepts an upstream model name as-is', async () => {
      await expect(service.resolve({ reportedModel: 'seeed_e1002' })).resolves.toBe(SEEED_E1002)
    })

    it('resolves nothing for an unknown name without dimensions', async () => {
      await expect(service.resolve({ reportedModel: 'unknown_board' })).resolves.toBeNull()
      await expect(service.resolve({})).resolves.toBeNull()
    })

    it('matches an unknown name on dimensions, preferring TRMNL hardware', async () => {
      await expect(service.resolve({ reportedModel: 'unknown_x_class', width: 1872, height: 1404 })).resolves.toBe(V2)
    })

    it('matches on dimensions when no name is reported at all', async () => {
      await expect(service.resolve({ width: 1872, height: 1404 })).resolves.toBe(V2)
    })

    it('falls back to the OG model when nothing matches', async () => {
      await expect(service.resolve({ reportedModel: 'waveshare_397', width: 480, height: 800 })).resolves.toBe(OG_PLUS)
    })

    it('deterministically prefers the fallback model over other TRMNL hardware at the same dimensions, regardless of DB order', async () => {
      modelRepo.find.mockResolvedValueOnce([OG_BWRY, OG_PNG, OG_PLUS])
      await expect(service.resolve({ reportedModel: 'unknown_800x480_board', width: 800, height: 480 })).resolves.toBe(OG_PLUS)
    })

    it('deterministically prefers TRMNL hardware over BYOD at the same dimensions, regardless of DB order', async () => {
      modelRepo.find.mockResolvedValueOnce([ONYX_BOOX_NOVA_AIR_C, V2])
      await expect(service.resolve({ reportedModel: 'unknown_x_class', width: 1872, height: 1404 })).resolves.toBe(V2)
    })
  })

  describe('defaultPaletteFor', () => {
    it('picks the palette with the most grays', async () => {
      await expect(service.defaultPaletteFor(V2)).resolves.toBe(GRAY_16)
      await expect(service.defaultPaletteFor(OG_PLUS)).resolves.toBe(GRAY_4)
    })

    it('prefers a colour palette over grays', async () => {
      await expect(service.defaultPaletteFor(SEEED_E1002)).resolves.toBe(COLOR_6A)
    })

    it('returns null when the model lists no known palettes', async () => {
      await expect(service.defaultPaletteFor({ ...OG_PLUS, paletteIds: ['nope'] })).resolves.toBeNull()
    })
  })

  describe('compatibleFamiliesFor', () => {
    it('returns every colour family represented among the model\'s official palettes', async () => {
      await expect(service.compatibleFamiliesFor(SEEED_E1002)).resolves.toEqual(new Set(['screen--color-6a']))
    })

    it('returns an empty set for a model with only grayscale official palettes', async () => {
      await expect(service.compatibleFamiliesFor(OG_PLUS)).resolves.toEqual(new Set())
    })

    it('is derived from paletteIds-matched rows, not from colors/bitDepth', async () => {
      const grayscaleOnlyModel = { ...OG_PLUS, colors: 999, bitDepth: 99, paletteIds: ['bw'] }
      await expect(service.compatibleFamiliesFor(grayscaleOnlyModel)).resolves.toEqual(new Set())
    })
  })

  describe('assignResolvedModel', () => {
    it('sets model and default palette on the device', async () => {
      const device: DeviceReport & { deviceModel?: DeviceModel | null, palette?: Palette | null } = { reportedModel: 'x', width: 1872, height: 1404 }
      await expect(service.assignResolvedModel(device)).resolves.toBe(V2)
      expect(device.deviceModel).toBe(V2)
      expect(device.palette).toBe(GRAY_16)
    })

    it('leaves the device untouched when nothing resolves', async () => {
      const device: DeviceReport & { deviceModel?: DeviceModel | null, palette?: Palette | null } = { reportedModel: 'unknown_board' }
      await expect(service.assignResolvedModel(device)).resolves.toBeNull()
      expect(device.deviceModel).toBeUndefined()
      expect(device.palette).toBeUndefined()
    })
  })

  describe('renderTargetFor', () => {
    it('uses the assigned model and palette', async () => {
      await expect(service.renderTargetFor({ deviceModel: V2, palette: BW })).resolves.toEqual({ model: V2, palette: BW })
    })

    it('fills in the default palette when only a model is assigned', async () => {
      await expect(service.renderTargetFor({ deviceModel: V2, palette: null })).resolves.toEqual({ model: V2, palette: GRAY_16 })
    })

    it('renders unassigned devices as an OG with 4 grays', async () => {
      await expect(service.renderTargetFor({})).resolves.toEqual({ model: OG_PLUS, palette: GRAY_4 })
    })

    it('falls back to the bundled snapshot when the reference table is empty', async () => {
      modelRepo.findOneBy.mockResolvedValue(null)
      paletteRepo.find.mockResolvedValue([])
      const { model, palette } = await service.renderTargetFor({})
      expect(model.name).toBe('og_plus')
      expect(model.width).toBe(800)
      expect(palette.id).toBe('gray-4')
    })
  })
})
