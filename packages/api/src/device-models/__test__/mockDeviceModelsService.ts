import type { DeviceModel } from '../entities/device-model.entity'
import type { Palette } from '../entities/palette.entity'
import { vi } from 'vitest'

export const OG_PLUS: DeviceModel = {
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
  paletteIds: ['bw', 'gray-4'],
  cssClasses: ['screen--og_plus', 'screen--md', 'screen--density-1x'],
  cssVariables: { '--screen-w': '800px', '--screen-h': '480px' },
  imageSizeLimit: 90000,
  deprecated: false,
  syncedAt: null,
}

export const V2: DeviceModel = {
  ...OG_PLUS,
  name: 'v2',
  label: 'TRMNL X',
  width: 1872,
  height: 1404,
  colors: 16,
  bitDepth: 4,
  scaleFactor: 1.8,
  paletteIds: ['gray-16', 'gray-4', 'bw'],
  cssClasses: ['screen--v2', 'screen--lg', 'screen--density-2x'],
  cssVariables: { '--screen-w': '1040px', '--screen-h': '780px' },
}

export const BW: Palette = { id: 'bw', name: 'Black & White (1-bit)', grays: 2, colors: null, frameworkClass: 'screen--1bit', grayscaleBitDepth: null, deprecated: false, syncedAt: null }
export const GRAY_4: Palette = { id: 'gray-4', name: '4 Grays (2-bit)', grays: 4, colors: null, frameworkClass: 'screen--2bit', grayscaleBitDepth: null, deprecated: false, syncedAt: null }
export const GRAY_16: Palette = { id: 'gray-16', name: '16 Grays (4-bit)', grays: 16, colors: null, frameworkClass: 'screen--4bit', grayscaleBitDepth: null, deprecated: false, syncedAt: null }

export function createMockDeviceModelsService() {
  return {
    findAll: vi.fn(),
    findByName: vi.fn(),
    findAllPalettes: vi.fn(),
    findPalette: vi.fn(),
    allowedPalettesFor: vi.fn(),
    defaultPaletteFor: vi.fn(),
    resolve: vi.fn(),
    assignResolvedModel: vi.fn(),
    renderTargetFor: vi.fn(),
    outputSizeFor: vi.fn(),
  }
}

export type MockDeviceModelsService = ReturnType<typeof createMockDeviceModelsService>

/** Default behaviour after `vi.resetAllMocks()`: everything renders as an OG with 4 grays. */
export function primeMockDeviceModelsService(mock: MockDeviceModelsService) {
  mock.renderTargetFor.mockResolvedValue({ model: OG_PLUS, palette: GRAY_4 })
  mock.outputSizeFor.mockResolvedValue({ width: OG_PLUS.width, height: OG_PLUS.height })
  mock.defaultPaletteFor.mockResolvedValue(GRAY_4)
  mock.resolve.mockResolvedValue(null)
  mock.assignResolvedModel.mockResolvedValue(null)
}
