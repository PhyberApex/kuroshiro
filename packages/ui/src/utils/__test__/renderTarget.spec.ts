import type { DeviceModel, Palette } from '@/types'
import { describe, expect, it } from 'vitest'
import { DEFAULT_MODEL, DEFAULT_PALETTE, renderTargetFor, richestPalette } from '../renderTarget'

const BW: Palette = { id: 'bw', name: 'bw', grays: 2, frameworkClass: 'screen--1bit', deprecated: false }
const GRAY_4: Palette = { id: 'gray-4', name: 'g4', grays: 4, frameworkClass: 'screen--2bit', deprecated: false }
const COLOR: Palette = { id: 'color-6a', name: 'c', grays: 2, colors: ['#f00', '#0f0', '#00f', '#ff0', '#000', '#fff'], frameworkClass: 'screen--color-6a', deprecated: false }
const OG: DeviceModel = { ...DEFAULT_MODEL, cssVariables: { '--screen-w': '800px' } }
const V2: DeviceModel = { ...DEFAULT_MODEL, name: 'v2', width: 1872, height: 1404, paletteIds: ['bw'] }

const source = {
  getByName: (name: string | null | undefined) => [OG, V2].find(m => m.name === name),
  palettesFor: (model: DeviceModel | null | undefined) => [BW, GRAY_4, COLOR].filter(p => model?.paletteIds.includes(p.id)),
}

describe('renderTarget', () => {
  it('prefers colour palettes, then more grays', () => {
    expect(richestPalette([BW, GRAY_4])).toBe(GRAY_4)
    expect(richestPalette([GRAY_4, COLOR])).toBe(COLOR)
    expect(richestPalette([])).toBeUndefined()
  })

  it('uses the device assignment when present', () => {
    expect(renderTargetFor({ deviceModel: V2, palette: BW }, source)).toEqual({ model: V2, palette: BW })
  })

  it('fills the richest allowed palette when only the model is assigned', () => {
    expect(renderTargetFor({ deviceModel: OG, palette: null }, source)).toEqual({ model: OG, palette: GRAY_4 })
  })

  it('falls back to the loaded OG model for unassigned devices, then to the built-in default', () => {
    expect(renderTargetFor(null, source)).toEqual({ model: OG, palette: GRAY_4 })
    expect(renderTargetFor(null, { getByName: () => undefined, palettesFor: () => [] })).toEqual({ model: DEFAULT_MODEL, palette: DEFAULT_PALETTE })
  })
})
