import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DeviceModelsService } from '../device-models.service'
import { BW, GRAY_4, GRAY_16, OG_PLUS, V2 } from './mockDeviceModelsService'

const SEEED_E1003 = { ...V2, name: 'seeed_e1003', label: 'reTerminal E1003', kind: 'byod' }
const COLOR_6A = { ...BW, id: 'color-6a', name: 'Color (6 colors)', grays: 2, colors: ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#000000', '#FFFFFF'], frameworkClass: 'screen--color-6a', grayscaleBitDepth: 1 }
const SEEED_E1002 = { ...OG_PLUS, name: 'seeed_e1002', label: 'reTerminal E1002', kind: 'byod', paletteIds: ['color-6a', 'bw'] }

function createMockRepo() {
  return {
    find: vi.fn(),
    findOneBy: vi.fn(),
  }
}

describe('deviceModelsService', () => {
  let service: DeviceModelsService
  let modelRepo: ReturnType<typeof createMockRepo>
  let paletteRepo: ReturnType<typeof createMockRepo>

  const models = [OG_PLUS, V2, SEEED_E1003, SEEED_E1002]
  const palettes = [BW, GRAY_4, GRAY_16, COLOR_6A]

  beforeEach(() => {
    modelRepo = createMockRepo()
    paletteRepo = createMockRepo()
    modelRepo.findOneBy.mockImplementation(async ({ name }) => models.find(m => m.name === name) ?? null)
    modelRepo.find.mockImplementation(async ({ where } = {}) =>
      where ? models.filter(m => m.width === where.width && m.height === where.height && m.deprecated === where.deprecated) : models)
    paletteRepo.find.mockResolvedValue(palettes)
    paletteRepo.findOneBy.mockImplementation(async ({ id }) => palettes.find(p => p.id === id) ?? null)
    service = new DeviceModelsService(modelRepo as any, paletteRepo as any)
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
      await expect(service.resolve({ reportedModel: 'waveshare' })).resolves.toBeNull()
      await expect(service.resolve({})).resolves.toBeNull()
    })

    it('matches an unknown name on dimensions, preferring TRMNL hardware', async () => {
      await expect(service.resolve({ reportedModel: 'lilygo', width: 1872, height: 1404 })).resolves.toBe(V2)
    })

    it('matches on dimensions when no name is reported at all', async () => {
      await expect(service.resolve({ width: 1872, height: 1404 })).resolves.toBe(V2)
    })

    it('falls back to the OG model when nothing matches', async () => {
      await expect(service.resolve({ reportedModel: 'waveshare_397', width: 480, height: 800 })).resolves.toBe(OG_PLUS)
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

  describe('assignResolvedModel', () => {
    it('sets model and default palette on the device', async () => {
      const device = { reportedModel: 'x', width: 1872, height: 1404 } as any
      await expect(service.assignResolvedModel(device)).resolves.toBe(V2)
      expect(device.deviceModel).toBe(V2)
      expect(device.palette).toBe(GRAY_16)
    })

    it('leaves the device untouched when nothing resolves', async () => {
      const device = { reportedModel: 'waveshare' } as any
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
      await expect(service.outputSizeFor({})).resolves.toEqual({ width: 800, height: 480 })
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
