import { describe, expect, it } from 'vitest'
import { makeDevice } from '../../test/fixtures.js'
import { BW, CUSTOM_RED_3BWR, OG_PLUS } from '../../test/mockDeviceModelsService.js'
import { toDeviceModelList, toDeviceModelRead, toPaletteRead } from '../device-models.mapper.js'

describe('the Device Model read model', () => {
  it('names every key, with absent values as null', () => {
    const read = toDeviceModelRead({ ...OG_PLUS, description: undefined, imageSizeLimit: undefined }, { paletteIds: ['bw'], defaultPaletteId: 'bw', usedBy: [] })

    expect(JSON.parse(JSON.stringify(read))).toEqual({
      name: 'og_plus',
      label: 'TRMNL OG (2-bit)',
      description: null,
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
      paletteIds: ['bw'],
      defaultPaletteId: 'bw',
      cssClasses: ['screen--og_plus', 'screen--md', 'screen--density-1x'],
      cssVariables: { '--screen-w': '800px', '--screen-h': '480px' },
      imageSizeLimit: null,
      deprecated: false,
      syncedAt: null,
      usedBy: [],
    })
  })

  it('serializes the sync time and names the Devices by name, ignoring case', () => {
    const devices = [makeDevice({ id: 'd1', name: 'kitchen', apikey: 'secret' }), makeDevice({ id: 'd2', name: 'Attic' })]

    const read = toDeviceModelRead({ ...OG_PLUS, syncedAt: new Date('2026-10-01T04:00:00.000Z') }, { paletteIds: [], defaultPaletteId: null, usedBy: devices })

    expect(read.syncedAt).toBe('2026-10-01T04:00:00.000Z')
    expect(read.usedBy).toEqual([{ id: 'd2', name: 'Attic' }, { id: 'd1', name: 'kitchen' }])
  })

  it('wraps the list with the last sync as a read model, or null before the first', () => {
    expect(toDeviceModelList(null, [])).toEqual({ lastSync: null, models: [] })
    expect(toDeviceModelList({ kind: 'device-models', ranAt: new Date('2026-10-01T04:00:00.000Z'), ok: true, error: null }, []))
      .toEqual({ lastSync: { ranAt: '2026-10-01T04:00:00.000Z', ok: true, error: null }, models: [] })
  })
})

describe('the Palette read model', () => {
  it('names every key, with absent colours as null', () => {
    expect(JSON.parse(JSON.stringify(toPaletteRead({ ...BW, colors: undefined, grayscaleBitDepth: undefined }, [])))).toEqual({
      id: 'bw',
      name: 'Black & White (1-bit)',
      kind: 'official',
      grays: 2,
      colors: null,
      frameworkClass: 'screen--1bit',
      grayscaleBitDepth: null,
      deprecated: false,
      syncedAt: null,
      usedBy: [],
    })
  })

  it('keeps the colours of a custom Palette and names its Devices', () => {
    const read = toPaletteRead(CUSTOM_RED_3BWR, [makeDevice({ id: 'd1', name: 'Hallway', apikey: 'secret' })])

    expect(read.colors).toEqual(['#ff0000', '#ffffff', '#000000'])
    expect(read.usedBy).toEqual([{ id: 'd1', name: 'Hallway' }])
  })
})
