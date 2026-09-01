import type { TrmnlModelPayload, TrmnlPalettePayload } from '../trmnl-payloads.js'
import { describe, expect, it } from 'vitest'
import { validateModelPayload, validatePalettePayload } from '../trmnl-payloads.js'

function model(overrides: Partial<TrmnlModelPayload> = {}): TrmnlModelPayload {
  return {
    name: 'og_plus',
    label: 'TRMNL OG (2-bit)',
    width: 800,
    height: 480,
    colors: 4,
    bit_depth: 2,
    scale_factor: 1,
    rotation: 0,
    mime_type: 'image/png',
    offset_x: 0,
    offset_y: 0,
    kind: 'trmnl',
    palette_ids: ['bw', 'gray-4'],
    css: { classes: { device: 'screen--og_plus', size: 'screen--md' }, variables: [] },
    ...overrides,
  }
}

function palette(overrides: Partial<TrmnlPalettePayload> = {}): TrmnlPalettePayload {
  return {
    id: 'gray-4',
    name: '4 Grays (2-bit)',
    grays: 4,
    colors: ['#000000', '#ffffff'],
    framework_class: 'screen--2bit',
    ...overrides,
  }
}

describe('validateModelPayload', () => {
  it('accepts a well-formed payload', () => {
    expect(validateModelPayload(model())).toBeNull()
  })

  it('rejects a name that would escape a filesystem path', () => {
    expect(validateModelPayload(model({ name: '../../etc/passwd' }))).toMatch(/name/)
  })

  it('rejects an invalid palette id', () => {
    expect(validateModelPayload(model({ palette_ids: ['bw', '../evil'] }))).toMatch(/palette id/)
  })

  it.each(['width', 'height', 'colors', 'bit_depth', 'scale_factor', 'rotation', 'offset_x', 'offset_y'] as const)('rejects a non-finite %s', (field) => {
    expect(validateModelPayload(model({ [field]: Number.NaN }))).toMatch(new RegExp(field))
  })

  it('rejects a css class that would break the stylesheet', () => {
    expect(validateModelPayload(model({ css: { classes: { device: 'screen--og_plus; DROP TABLE' } } }))).toMatch(/css class/)
  })
})

describe('validatePalettePayload', () => {
  it('accepts a well-formed payload', () => {
    expect(validatePalettePayload(palette())).toBeNull()
  })

  it('rejects an id that would escape a shell string or filesystem path', () => {
    expect(validatePalettePayload(palette({ id: '$(rm -rf /)' }))).toMatch(/palette id/)
  })

  it('rejects a colour that is not a plain hex value', () => {
    expect(validatePalettePayload(palette({ colors: ['#ffffff', '"; rm -rf / #'] }))).toMatch(/colour/)
  })
})
