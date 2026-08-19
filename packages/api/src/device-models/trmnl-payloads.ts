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

const ID_PATTERN = /^[\w.-]+$/
const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i
const CSS_CLASS_PATTERN = /^[\w-]+$/
const MODEL_NUMERIC_FIELDS = ['width', 'height', 'colors', 'bit_depth', 'scale_factor', 'rotation', 'offset_x', 'offset_y'] as const

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

/**
 * Rejects a synced model payload whose values would otherwise flow unescaped
 * into shell commands (ImageMagick) or filesystem paths (colormap/fallback
 * screen caches). Returns a human-readable reason, or null if the payload is safe.
 */
export function validateModelPayload(payload: TrmnlModelPayload): string | null {
  if (!ID_PATTERN.test(payload.name))
    return `model name "${payload.name}" contains invalid characters`
  for (const id of payload.palette_ids ?? []) {
    if (!ID_PATTERN.test(id))
      return `model "${payload.name}" has invalid palette id "${id}"`
  }
  for (const field of MODEL_NUMERIC_FIELDS) {
    if (!isFiniteNumber(payload[field]))
      return `model "${payload.name}" has a non-finite ${field}`
  }
  for (const cssClass of Object.values(payload.css?.classes ?? {})) {
    if (!CSS_CLASS_PATTERN.test(cssClass))
      return `model "${payload.name}" has invalid css class "${cssClass}"`
  }
  return null
}

/** Rejects a synced palette payload whose id or colours would otherwise flow unescaped into shell commands or filesystem paths. */
export function validatePalettePayload(payload: TrmnlPalettePayload): string | null {
  if (!ID_PATTERN.test(payload.id))
    return `palette id "${payload.id}" contains invalid characters`
  for (const color of payload.colors ?? []) {
    if (!HEX_COLOR_PATTERN.test(color))
      return `palette "${payload.id}" has invalid colour "${color}"`
  }
  return null
}

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
