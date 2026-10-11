import type { Palette } from '../entities/palette.entity.js'
import { beforeEach, describe, expect, it } from 'vitest'
import { BW, GRAY_4, GRAY_16, OG_PLUS, V2 } from '../../test/mockDeviceModelsService.js'
import { asRepository, createMockRepository } from '../../test/mockRepository.js'
import { PaletteSelectionService } from '../palette-selection.service.js'

const COLOR_6A = { ...BW, id: 'color-6a', name: 'Color (6 colors)', grays: 2, colors: ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#000000', '#FFFFFF'], frameworkClass: 'screen--color-6a', grayscaleBitDepth: 1 }
const SEEED_E1002 = { ...OG_PLUS, name: 'seeed_e1002', label: 'reTerminal E1002', kind: 'byod', paletteIds: ['color-6a', 'bw'] }

function firstWhere<T>(where: T | T[] | undefined): T | undefined {
  return Array.isArray(where) ? where[0] : where
}

describe('paletteSelectionService', () => {
  let service: PaletteSelectionService
  let paletteRepo: ReturnType<typeof createMockRepository<Palette>>

  const palettes = [BW, GRAY_4, GRAY_16, COLOR_6A]

  beforeEach(() => {
    paletteRepo = createMockRepository<Palette>()
    paletteRepo.find.mockResolvedValue(palettes)
    paletteRepo.findOneBy.mockImplementation(async (where) => {
      const w = firstWhere(where)
      return palettes.find(p => p.id === w?.id) ?? null
    })
    service = new PaletteSelectionService(asRepository(paletteRepo))
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

  describe('supportsPalette', () => {
    it('accepts a curated official palette and refuses one the model does not list', async () => {
      await expect(service.supportsPalette(OG_PLUS, GRAY_4)).resolves.toBe(true)
      await expect(service.supportsPalette(OG_PLUS, GRAY_16)).resolves.toBe(false)
    })
  })
})
