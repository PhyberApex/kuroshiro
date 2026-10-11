import { describe, expect, it } from 'vitest'
import { buildDeviceModel, buildPalette } from '@/testing/fixtures/device-models'
import { buildFirmware } from '@/testing/fixtures/firmware'
import {
  deviceModelOptions,
  firmwareOptions,
  NO_TARGET,
  paletteOptions,
} from '../deviceCatalogOptions'

describe('the Device Models offered', () => {
  const models = [
    buildDeviceModel({ name: 'og_plus', label: 'TRMNL OG (2-bit)', width: 800, height: 480 }),
    buildDeviceModel({ name: 'v2', label: 'TRMNL X', width: 1872, height: 1404 }),
    buildDeviceModel({ name: 'old', label: 'Kindle 4', width: 600, height: 800, deprecated: true }),
  ]

  it('are named with their size and leave out a deprecated one', () => {
    expect(deviceModelOptions(models, 'og_plus')).toEqual([
      { value: 'og_plus', label: 'TRMNL OG (2-bit) · 800 × 480' },
      { value: 'v2', label: 'TRMNL X · 1872 × 1404' },
    ])
  })

  it('keep a deprecated one while it is the assigned one', () => {
    expect(deviceModelOptions(models, 'old').map(option => option.value)).toEqual(['og_plus', 'v2', 'old'])
  })
})

describe('the Palettes offered', () => {
  const palettes = [
    buildPalette({ id: 'bw', name: 'Black and white' }),
    buildPalette({ id: 'gray-4', name: 'Greyscale, 4 levels' }),
    buildPalette({ id: 'warm', name: 'Warm paper', kind: 'custom' }),
    buildPalette({ id: 'color-6', name: 'Colour, 6 inks' }),
  ]

  it('are those of the Device Model, in its order, a custom one marked', () => {
    const model = buildDeviceModel({ paletteIds: ['gray-4', 'bw', 'warm'] })

    expect(paletteOptions(model, palettes, { id: 'gray-4', name: 'Greyscale, 4 levels', kind: 'official' })).toEqual([
      { value: 'gray-4', label: 'Greyscale, 4 levels' },
      { value: 'bw', label: 'Black and white' },
      { value: 'warm', label: 'Warm paper · custom' },
    ])
  })

  it('keep the assigned one when the Device Model does not list it', () => {
    const model = buildDeviceModel({ paletteIds: ['bw'] })

    expect(paletteOptions(model, palettes, { id: 'gone', name: 'Sepia', kind: 'custom' })).toEqual([
      { value: 'bw', label: 'Black and white' },
      { value: 'gone', label: 'Sepia · custom' },
    ])
  })

  it('are the assigned one alone until a Device Model is resolved', () => {
    expect(paletteOptions(undefined, palettes, { id: 'bw', name: 'Black and white', kind: 'official' })).toEqual([{ value: 'bw', label: 'Black and white' }])
    expect(paletteOptions(undefined, palettes, null)).toEqual([])
  })
})

describe('the Firmware offered as a target', () => {
  const firmware = [
    buildFirmware({ id: 'official', version: '1.7.9', compatibleModels: ['og_png', 'og_plus'] }),
    buildFirmware({ id: 'custom', version: '1.8.0-rc2', kind: 'custom', label: 'Kitchen test build' }),
    buildFirmware({ id: 'unlabelled', version: '1.8.0-rc1', kind: 'custom', label: null }),
    buildFirmware({ id: 'for-x', version: '2.0.1', compatibleModels: ['v2'] }),
    buildFirmware({ id: 'retired', version: '1.6.9', deprecated: true }),
  ]
  const on = { deviceModel: 'og_plus', target: null, pushPending: false }

  it('is "None", then what fits the Device Model and is not deprecated, worded by kind', () => {
    expect(firmwareOptions(firmware, on)).toEqual([
      { value: NO_TARGET, label: 'None', disabled: false, reason: undefined },
      { value: 'official', label: '1.7.9 · official' },
      { value: 'custom', label: '1.8.0-rc2 · custom · Kitchen test build' },
      { value: 'unlabelled', label: '1.8.0-rc1 · custom' },
    ])
  })

  it('keeps the assigned one, deprecated or not fitting', () => {
    const target = { id: 'retired', version: '1.6.9', kind: 'official-synced' as const, label: null, deprecated: true }

    expect(firmwareOptions(firmware, { ...on, target }).map(option => option.value)).toEqual([NO_TARGET, 'official', 'custom', 'unlabelled', 'retired'])
  })

  it('offers only Firmware for every Device Model until one is resolved', () => {
    expect(firmwareOptions(firmware, { ...on, deviceModel: null }).map(option => option.value)).toEqual([NO_TARGET, 'custom', 'unlabelled'])
  })

  it('cannot go back to "None" while a push is pending', () => {
    expect(firmwareOptions(firmware, { ...on, pushPending: true })[0]).toEqual({ value: NO_TARGET, label: 'None', disabled: true, reason: 'A push is pending' })
  })
})
