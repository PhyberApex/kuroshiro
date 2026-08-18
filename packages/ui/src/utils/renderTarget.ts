import type { Device, DeviceModel, Palette } from '../types'
import type { RenderTarget } from './screenShell'

export const DEFAULT_MODEL_NAME = 'og_plus'

/** Offline stand-in for the OG model until the device model list has loaded. */
export const DEFAULT_MODEL: DeviceModel = {
  name: DEFAULT_MODEL_NAME,
  label: 'TRMNL OG (2-bit)',
  width: 800,
  height: 480,
  colors: 4,
  bitDepth: 2,
  scaleFactor: 1,
  rotation: 0,
  offsetX: 0,
  offsetY: 0,
  mimeType: 'image/png',
  kind: 'trmnl',
  paletteIds: ['bw', 'gray-4'],
  cssClasses: ['screen--og_plus', 'screen--md', 'screen--density-1x'],
  cssVariables: {},
  deprecated: false,
}

export const DEFAULT_PALETTE: Palette = {
  id: 'gray-4',
  name: '4 Grays (2-bit)',
  grays: 4,
  frameworkClass: 'screen--2bit',
  deprecated: false,
}

function paletteRichness(palette: Palette): number {
  return palette.colors?.length ? 1000 + palette.colors.length : palette.grays
}

export function richestPalette(palettes: Palette[]): Palette | undefined {
  return palettes.reduce<Palette | undefined>((richest, candidate) =>
    !richest || paletteRichness(candidate) > paletteRichness(richest) ? candidate : richest, undefined)
}

export interface RenderTargetSource {
  getByName: (name: string | null | undefined) => DeviceModel | undefined
  palettesFor: (model: DeviceModel | null | undefined) => Palette[]
}

/** The model and palette a device's images are generated with, falling back like the API does. */
export function renderTargetFor(device: Pick<Device, 'deviceModel' | 'palette'> | null | undefined, source: RenderTargetSource): RenderTarget {
  const model = device?.deviceModel ?? source.getByName(DEFAULT_MODEL_NAME) ?? DEFAULT_MODEL
  const palette = device?.palette ?? richestPalette(source.palettesFor(model)) ?? DEFAULT_PALETTE
  return { model, palette }
}
