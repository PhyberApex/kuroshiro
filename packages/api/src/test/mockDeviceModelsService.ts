import type { Mock } from 'vitest'
import type { DeviceModel } from '../device-models/entities/device-model.entity.js'
import type { Palette } from '../device-models/entities/palette.entity.js'
import { vi } from 'vitest'
import { makeDeviceModel } from './fixtures.js'

export const OG_PLUS: DeviceModel = makeDeviceModel()

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

export const BW: Palette = { id: 'bw', name: 'Black & White (1-bit)', kind: 'official', grays: 2, colors: null, frameworkClass: 'screen--1bit', grayscaleBitDepth: null, deprecated: false, syncedAt: null }
export const GRAY_4: Palette = { id: 'gray-4', name: '4 Grays (2-bit)', kind: 'official', grays: 4, colors: null, frameworkClass: 'screen--2bit', grayscaleBitDepth: null, deprecated: false, syncedAt: null }
export const GRAY_16: Palette = { id: 'gray-16', name: '16 Grays (4-bit)', kind: 'official', grays: 16, colors: null, frameworkClass: 'screen--4bit', grayscaleBitDepth: null, deprecated: false, syncedAt: null }
export const COLOR_6A: Palette = { id: 'color-6a', name: 'Color (6 colors)', kind: 'official', grays: 2, colors: ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#000000', '#FFFFFF'], frameworkClass: 'screen--color-6a', grayscaleBitDepth: 1, deprecated: false, syncedAt: null }
export const CUSTOM_RED_3BWR: Palette = { id: 'a1b2c3d4-e5f6-4789-a0b1-c2d3e4f5a6b7', name: 'My Red', kind: 'custom', grays: 2, colors: ['#ff0000', '#ffffff', '#000000'], frameworkClass: 'screen--color-3bwr', grayscaleBitDepth: null, deprecated: false, syncedAt: null }

export const SEEED_E1002: DeviceModel = { ...OG_PLUS, name: 'seeed_e1002', label: 'reTerminal E1002', kind: 'byod', paletteIds: ['color-6a', 'bw'] }

export interface MockDeviceModelsService {
  findAll: Mock
  findByName: Mock
  resolve: Mock
  assignResolvedModel: Mock
  renderTargetFor: Mock
}

export function createMockDeviceModelsService(): MockDeviceModelsService {
  return {
    findAll: vi.fn(),
    findByName: vi.fn(),
    resolve: vi.fn(),
    assignResolvedModel: vi.fn(),
    renderTargetFor: vi.fn(),
  }
}

/** Default behaviour after `vi.resetAllMocks()`: everything renders as an OG with 4 grays. */
export function primeMockDeviceModelsService(mock: MockDeviceModelsService) {
  mock.renderTargetFor.mockResolvedValue({ model: OG_PLUS, palette: GRAY_4 })
  mock.resolve.mockResolvedValue(null)
  mock.assignResolvedModel.mockResolvedValue(null)
}

export interface MockPaletteSelectionService {
  findAllPalettes: Mock
  findPalette: Mock
  allowedPalettesFor: Mock
  defaultPaletteFor: Mock
  supportsPalette: Mock
}

export function createMockPaletteSelectionService(): MockPaletteSelectionService {
  return {
    findAllPalettes: vi.fn(),
    findPalette: vi.fn(),
    allowedPalettesFor: vi.fn(),
    defaultPaletteFor: vi.fn(),
    supportsPalette: vi.fn(),
  }
}

export interface MockFallbackScreensService {
  urlFor: Mock
}

export function createMockFallbackScreensService(): MockFallbackScreensService {
  return { urlFor: vi.fn() }
}

/** Default behaviour after `vi.resetAllMocks()`: static placeholder URLs under http://api. */
export function primeMockFallbackScreensService(mock: MockFallbackScreensService) {
  mock.urlFor.mockImplementation(async ({ kind }: { kind: string }) => `http://api/screens/${kind}.png`)
}
