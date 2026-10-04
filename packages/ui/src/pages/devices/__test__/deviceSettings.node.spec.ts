import { describe, expect, it } from 'vitest'
import { buildDeviceModel, buildPalette } from '@/testing/fixtures/device-models'
import { buildFirmware } from '@/testing/fixtures/firmware'
import {
  deviceModelOptions,
  firmwareOptions,
  maskedKey,
  mirroringInput,
  NO_TARGET,
  paletteOptions,
  rateSeconds,
  rateShown,
  screensCounted,
  secondsOfDay,
  sleepWindowInput,
} from '../deviceSettings'

describe('the refresh rate', () => {
  it.each([
    [900, { amount: 15, unit: 'minutes' }],
    [60, { amount: 1, unit: 'minutes' }],
    [3600, { amount: 1, unit: 'hours' }],
    [86400, { amount: 24, unit: 'hours' }],
    [5400, { amount: 90, unit: 'minutes' }],
    [90, { amount: 1.5, unit: 'minutes' }],
  ])('shows %i seconds as whole hours where it is, in minutes otherwise', (seconds, shown) => {
    expect(rateShown(seconds)).toEqual(shown)
  })

  it.each([
    [15, 'minutes', 900],
    [2, 'hours', 7200],
    [1, 'minutes', 60],
    [24, 'hours', 86400],
    [1.5, 'minutes', 90],
  ] as const)('sends %d %s as seconds', (amount, unit, seconds) => {
    expect(rateSeconds({ amount, unit })).toBe(seconds)
  })

  it.each([
    [0, 'minutes'],
    [0.5, 'minutes'],
    [1441, 'minutes'],
    [25, 'hours'],
    [0.0001, 'hours'],
    [null, 'minutes'],
  ] as const)('has no seconds for %s %s, which is outside 1 minute to 24 hours or no whole second', (amount, unit) => {
    expect(rateSeconds({ amount, unit })).toBeUndefined()
  })
})

describe('the hours of Sleep Mode', () => {
  it('are seconds of day on the wire', () => {
    expect(secondsOfDay('00:00')).toBe(0)
    expect(secondsOfDay('06:00')).toBe(21600)
    expect(secondsOfDay('23:59')).toBe(86340)
  })

  it('send only the end that was given', () => {
    expect(sleepWindowInput({ start: '22:30' })).toEqual({ sleepStartTime: 81000 })
    expect(sleepWindowInput({ end: '07:00' })).toEqual({ sleepEndTime: 25200 })
    expect(sleepWindowInput({ start: '23:00', end: '06:00' })).toEqual({ sleepStartTime: 82800, sleepEndTime: 21600 })
  })
})

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

describe('what Mirroring sends', () => {
  const off = { enabled: false, mac: null, apikeySet: false }
  const kept = { enabled: false, mac: 'A4:CF:12:9B:01:7E', apikeySet: true }
  const mirrored = { ...kept, enabled: true }

  it('is nothing while it is switched on without a valid MAC address and an API key', () => {
    expect(mirroringInput({ on: true, mac: '', key: '' }, off)).toBeUndefined()
    expect(mirroringInput({ on: true, mac: 'A4:CF:12:9B:01:7E', key: '' }, off)).toBeUndefined()
    expect(mirroringInput({ on: true, mac: 'A4:CF:12', key: 'secret' }, off)).toBeUndefined()
  })

  it('is on with both, the MAC address upper-case, once both are valid', () => {
    expect(mirroringInput({ on: true, mac: ' a4:cf:12:9b:01:7e ', key: 'secret' }, off))
      .toEqual({ mirrorEnabled: true, mirrorMac: 'A4:CF:12:9B:01:7E', mirrorApikey: 'secret' })
  })

  it('is on alone when both values were kept', () => {
    expect(mirroringInput({ on: true, mac: 'A4:CF:12:9B:01:7E', key: '' }, kept)).toEqual({ mirrorEnabled: true })
  })

  it('is off alone, which keeps both values', () => {
    expect(mirroringInput({ on: false, mac: 'A4:CF:12:9B:01:7E', key: '' }, mirrored)).toEqual({ mirrorEnabled: false })
    expect(mirroringInput({ on: false, mac: '', key: '' }, off)).toBeUndefined()
  })

  it('is only the value that changed while Mirroring is on', () => {
    expect(mirroringInput({ on: true, mac: 'A4:CF:12:00:00:01', key: '' }, mirrored)).toEqual({ mirrorMac: 'A4:CF:12:00:00:01' })
    expect(mirroringInput({ on: true, mac: 'A4:CF:12:9B:01:7E', key: 'another' }, mirrored)).toEqual({ mirrorApikey: 'another' })
    expect(mirroringInput({ on: true, mac: 'A4:CF:12:9B:01:7E', key: '' }, mirrored)).toBeUndefined()
  })
})

describe('the words of the tucked sections', () => {
  it('masks an API key down to its last four characters', () => {
    expect(maskedKey('k7Qm2Zr9Xw4Tn8Vb')).toBe('••••••••••••n8Vb')
    expect(maskedKey('abc')).toBe('•••')
  })

  it('counts the Screens a Device loses', () => {
    expect(screensCounted(6)).toBe('6 Screens')
    expect(screensCounted(1)).toBe('1 Screen')
    expect(screensCounted(0)).toBe('0 Screens')
  })
})
