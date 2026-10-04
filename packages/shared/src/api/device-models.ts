import type { DeviceReference, SyncRun } from './firmware'

export type PaletteKind = 'official' | 'custom'

/** The colour Palette Families a custom Palette may be in, by `frameworkClass`. */
export const CUSTOM_PALETTE_FRAMEWORK_CLASSES = [
  'screen--color-3bwr',
  'screen--color-3bwy',
  'screen--color-4bwry',
  'screen--color-6a',
  'screen--color-7a',
] as const

export type CustomPaletteFrameworkClass = typeof CUSTOM_PALETTE_FRAMEWORK_CLASSES[number]

/** One colour of a Palette: `#RRGGBB`, in either letter case. */
export const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i

export interface CreateCustomPaletteInput {
  name: string
  frameworkClass: CustomPaletteFrameworkClass
  /** At least one. */
  colors: string[]
}

/** A Palette Family change is refused while a Device uses the Palette. */
export type UpdateCustomPaletteInput = Partial<CreateCustomPaletteInput>

export interface PaletteRead {
  id: string
  name: string
  kind: PaletteKind
  grays: number
  /** Hex colours of a colour Palette; `null` for a grayscale one. */
  colors: string[] | null
  frameworkClass: string
  grayscaleBitDepth: number | null
  deprecated: boolean
  syncedAt: string | null
  /** The Devices set to this Palette, by name. */
  usedBy: DeviceReference[]
}

export interface DeviceModelRead {
  name: string
  label: string
  description: string | null
  width: number
  height: number
  colors: number
  bitDepth: number
  scaleFactor: number
  rotation: number
  offsetX: number
  offsetY: number
  mimeType: string
  kind: string
  /** Every Palette a Device on this Device Model may be set to: TRMNL's curated ones, then the custom Palettes of a compatible Palette Family. */
  paletteIds: string[]
  /** The Palette a Device on this Device Model is given when it has none: the richest of TRMNL's curated ones. */
  defaultPaletteId: string | null
  cssClasses: string[]
  cssVariables: Record<string, string>
  imageSizeLimit: number | null
  deprecated: boolean
  syncedAt: string | null
  /** The Devices on this Device Model, by name. */
  usedBy: DeviceReference[]
}

export interface DeviceModelList {
  lastSync: SyncRun | null
  models: DeviceModelRead[]
}

export interface DeviceModelSyncResult {
  models: number
  palettes: number
  deprecatedModels: number
  deprecatedPalettes: number
  ranAt: string
}
