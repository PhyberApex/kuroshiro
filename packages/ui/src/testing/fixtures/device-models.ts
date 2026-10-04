import type { DeviceModelList, DeviceModelRead, PaletteRead } from 'kuroshiro-shared'
import { defineBuilder } from './defineBuilder'

export const buildPalette = defineBuilder<PaletteRead>(() => ({
  id: '5c9e2f7a-3b1d-4e8f-a6c4-0d2b7e9f1a3c',
  name: 'Greyscale, 4 levels',
  kind: 'official',
  grays: 4,
  colors: null,
  frameworkClass: 'screen--2bit',
  grayscaleBitDepth: 2,
  deprecated: false,
  syncedAt: '2026-10-03T04:00:00.000Z',
  usedBy: [],
}))

export const buildDeviceModel = defineBuilder<DeviceModelRead>(() => ({
  name: 'og_plus',
  label: 'TRMNL OG (2-bit)',
  description: 'TRMNL OG (2-bit)',
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
  paletteIds: ['5c9e2f7a-3b1d-4e8f-a6c4-0d2b7e9f1a3c'],
  defaultPaletteId: '5c9e2f7a-3b1d-4e8f-a6c4-0d2b7e9f1a3c',
  cssClasses: ['screen--og_plus'],
  cssVariables: {},
  imageSizeLimit: null,
  deprecated: false,
  syncedAt: '2026-10-03T04:00:00.000Z',
  usedBy: [],
}))

export const buildDeviceModelList = defineBuilder<DeviceModelList>(() => ({
  lastSync: { ranAt: '2026-10-03T04:00:00.000Z', ok: true, error: null },
  models: [buildDeviceModel()],
}))
