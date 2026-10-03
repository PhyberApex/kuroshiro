import type { DeviceReference, SyncRun } from './firmware'

export type PaletteKind = 'official' | 'custom'

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
