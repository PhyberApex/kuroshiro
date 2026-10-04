import type { CreateCustomPaletteInput, DeviceModelList, DeviceModelSyncResult, PaletteRead, UpdateCustomPaletteInput } from 'kuroshiro-shared'
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

/** Refused with `palette-name-taken` when a custom Palette already has the name in any letter case. */
export function createPalette(input: CreateCustomPaletteInput) {
  return apiSend<PaletteRead>('POST', 'device-models/palettes', input)
}

/** Converts the stored images of the Devices using it again. Refused with `palette-name-taken`, and with `palette-in-use` for a Palette Family change while a Device uses it. */
export function updatePalette(paletteId: string, input: UpdateCustomPaletteInput) {
  return apiSend<PaletteRead>('PATCH', `device-models/palettes/${paletteId}`, input)
}

/** Each Device using it goes back to its Device Model's default Palette, and its stored images are converted again. */
export function deletePalette(paletteId: string) {
  return apiSend('DELETE', `device-models/palettes/${paletteId}`)
}
