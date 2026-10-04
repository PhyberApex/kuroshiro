import type { DeviceModelList, PaletteRead } from 'kuroshiro-shared'
import { apiGet } from './client'

/** Every Device Model this Instance knows, each with the ids of the Palettes a Device on it may be set to. */
export function listDeviceModels() {
  return apiGet<DeviceModelList>('device-models')
}

export function listPalettes() {
  return apiGet<PaletteRead[]>('device-models/palettes')
}
