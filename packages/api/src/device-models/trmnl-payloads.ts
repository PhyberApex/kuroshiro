import type { DeviceModel } from './entities/device-model.entity'
import type { Palette } from './entities/palette.entity'

export const TRMNL_API_URL = 'https://usetrmnl.com/api'

export interface TrmnlModelPayload {
  name: string
  label: string
  description?: string | null
  width: number
  height: number
  colors: number
  bit_depth: number
  scale_factor: number
  rotation: number
  mime_type: string
  offset_x: number
  offset_y: number
  kind: string
  palette_ids: string[]
  image_size_limit?: number | null
  css?: {
    classes?: Record<string, string>
    variables?: Array<[string, string]>
  } | null
}

export interface TrmnlPalettePayload {
  id: string
  name: string
  grays: number
  colors?: string[]
  framework_class: string
  grayscale_bit_depth?: number
}

export type DeviceModelAttributes = Omit<DeviceModel, 'deprecated' | 'syncedAt'>
export type PaletteAttributes = Omit<Palette, 'deprecated' | 'syncedAt'>

export function toDeviceModelAttributes(payload: TrmnlModelPayload): DeviceModelAttributes {
  return {
    name: payload.name,
    label: payload.label,
    description: payload.description ?? null,
    width: payload.width,
    height: payload.height,
    colors: payload.colors,
    bitDepth: payload.bit_depth,
    scaleFactor: payload.scale_factor,
    rotation: payload.rotation,
    offsetX: payload.offset_x,
    offsetY: payload.offset_y,
    mimeType: payload.mime_type,
    kind: payload.kind,
    paletteIds: payload.palette_ids ?? [],
    cssClasses: Object.values(payload.css?.classes ?? {}),
    cssVariables: Object.fromEntries(payload.css?.variables ?? []),
    imageSizeLimit: payload.image_size_limit ?? null,
  }
}

export function toPaletteAttributes(payload: TrmnlPalettePayload): PaletteAttributes {
  return {
    id: payload.id,
    name: payload.name,
    grays: payload.grays,
    colors: payload.colors ?? null,
    frameworkClass: payload.framework_class,
    grayscaleBitDepth: payload.grayscale_bit_depth ?? null,
  }
}
