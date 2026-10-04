import type { DeviceModelList, DeviceModelSyncResult, PaletteRead } from 'kuroshiro-shared'
import { apiGet, apiSend } from './client'

/** Every Device Model this Instance knows, each with the ids of the Palettes a Device on it may be set to. */
export function listDeviceModels() {
  return apiGet<DeviceModelList>('device-models')
}

export function listPalettes() {
  return apiGet<PaletteRead[]>('device-models/palettes')
}

/** Asks TRMNL for its Device Models and Palettes now. Refused with `upstream-unreachable` when TRMNL gives no answer. */
export function syncDeviceModels() {
  return apiSend<DeviceModelSyncResult>('POST', 'device-models/sync')
}
