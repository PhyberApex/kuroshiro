import { describe, expect, it } from 'vitest'
import { BW, CUSTOM_RED_3BWR, GRAY_4, OG_PLUS } from '../../test/mockDeviceModelsService.js'
import { compatiblePaletteIds, paletteFitsModel } from '../palette-compatibility.js'

const COLOR_3BWR = { ...BW, id: 'color-3bwr', name: 'Red (3 colors)', frameworkClass: 'screen--color-3bwr' }
const CUSTOM_YELLOW_3BWY = { ...CUSTOM_RED_3BWR, id: 'custom-yellow', name: 'My Yellow', frameworkClass: 'screen--color-3bwy' }
const PALETTES = [BW, GRAY_4, COLOR_3BWR, CUSTOM_RED_3BWR, CUSTOM_YELLOW_3BWY]
const RED_MODEL = { ...OG_PLUS, paletteIds: ['color-3bwr', 'bw'] }

describe('palette compatibility', () => {
  it('lists the curated ids first, then the custom palettes of a represented colour family', () => {
    expect(compatiblePaletteIds(RED_MODEL, PALETTES)).toEqual(['color-3bwr', 'bw', CUSTOM_RED_3BWR.id])
  })

  it('offers no custom palette on a model with only grayscale palettes', () => {
    expect(compatiblePaletteIds(OG_PLUS, PALETTES)).toEqual(['bw', 'gray-4'])
  })

  it('fits exactly the palettes it lists', () => {
    const listed = compatiblePaletteIds(RED_MODEL, PALETTES)
    expect(PALETTES.filter(palette => paletteFitsModel(palette, RED_MODEL, PALETTES)).map(p => p.id).sort()).toEqual([...listed].sort())
  })
})
