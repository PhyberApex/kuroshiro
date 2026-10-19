import type { Palette } from '../entities/palette.entity.js'
import { beforeEach, describe, expect, it } from 'vitest'
import { BW, COLOR_6A, GRAY_4, GRAY_16, OG_PLUS, SEEED_E1002, V2 } from '../../test/mockDeviceModelsService.js'
import { asRepository, createMockRepository } from '../../test/mockRepository.js'
import { PaletteSelectionService } from '../palette-selection.service.js'

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

  describe('allowedPalettesFor', () => {
    it('answers [] for a Device Model with no paletteIds without touching the repository', async () => {
      await expect(service.allowedPalettesFor({ ...OG_PLUS, paletteIds: [] })).resolves.toEqual([])
      expect(paletteRepo.find).not.toHaveBeenCalled()
    })
  })

  describe('fallbackPaletteFor', () => {
    it('throws naming the model when the bundled snapshot holds no Palette for it', () => {
      expect(() => service.fallbackPaletteFor({ ...OG_PLUS, name: 'homemade_panel', paletteIds: ['nope'] }))
        .toThrow('Bundled palette snapshot has no palette for device model homemade_panel')
    })
  })

  describe('supportsPalette', () => {
    it('accepts a curated official palette and refuses one the model does not list', async () => {
      await expect(service.supportsPalette(OG_PLUS, GRAY_4)).resolves.toBe(true)
      await expect(service.supportsPalette(OG_PLUS, GRAY_16)).resolves.toBe(false)
    })
  })
})
