import type { DeviceModel, Palette } from '@/types'
import { describe, expect, it } from 'vitest'
import { DEFAULT_MODEL, DEFAULT_MODEL_NAME, DEFAULT_PALETTE, renderTargetFor, richestPalette } from '../renderTarget'

// This tsconfig has no Node types, so `process` is declared locally rather than
// pulling in @types/node just for a test-only path.
declare const process: { cwd: () => string }

// Paths are built at runtime (not string literals) so vue-tsc never resolves these
// modules into the UI's type-check program — the API package's decorator-based
// entities aren't valid under the UI's tsconfig and would fail the build.
const API_DEVICE_MODELS_DIR = `${process.cwd()}/../api/src/device-models`
const SNAPSHOT_PATH = `${API_DEVICE_MODELS_DIR}/data/trmnl-snapshot`
const PAYLOADS_PATH = `${API_DEVICE_MODELS_DIR}/trmnl-payloads`

interface TrmnlSnapshotModule {
  TRMNL_MODELS_SNAPSHOT: Array<Record<string, unknown>>
  TRMNL_PALETTES_SNAPSHOT: Array<Record<string, unknown>>
}
interface TrmnlPayloadsModule {
  toDeviceModelAttributes: (payload: Record<string, unknown>) => Record<string, unknown>
  toPaletteAttributes: (payload: Record<string, unknown>) => Record<string, unknown>
}

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

  it('matches the real og_plus snapshot entry, so the offline default cannot drift', async () => {
    const { TRMNL_MODELS_SNAPSHOT, TRMNL_PALETTES_SNAPSHOT } = await import(/* @vite-ignore */ SNAPSHOT_PATH) as TrmnlSnapshotModule
    const { toDeviceModelAttributes, toPaletteAttributes } = await import(/* @vite-ignore */ PAYLOADS_PATH) as TrmnlPayloadsModule

    const snapshotModel = TRMNL_MODELS_SNAPSHOT.find(model => model.name === DEFAULT_MODEL_NAME)
    const snapshotPalette = TRMNL_PALETTES_SNAPSHOT.find(palette => palette.id === DEFAULT_PALETTE.id)
    if (!snapshotModel || !snapshotPalette)
      throw new Error('og_plus / gray-4 missing from the TRMNL snapshot')

    const mappedModel = toDeviceModelAttributes(snapshotModel)
    const mappedPalette = toPaletteAttributes(snapshotPalette)

    expect(DEFAULT_MODEL.cssClasses).toEqual(mappedModel.cssClasses)
    expect(DEFAULT_MODEL.cssVariables).toEqual(mappedModel.cssVariables)
    expect(DEFAULT_MODEL).toMatchObject({
      width: mappedModel.width,
      height: mappedModel.height,
      colors: mappedModel.colors,
      bitDepth: mappedModel.bitDepth,
      scaleFactor: mappedModel.scaleFactor,
      rotation: mappedModel.rotation,
      offsetX: mappedModel.offsetX,
      offsetY: mappedModel.offsetY,
      mimeType: mappedModel.mimeType,
      kind: mappedModel.kind,
      paletteIds: mappedModel.paletteIds,
    })
    expect(DEFAULT_PALETTE).toMatchObject({
      name: mappedPalette.name,
      grays: mappedPalette.grays,
      frameworkClass: mappedPalette.frameworkClass,
    })
  })
})
