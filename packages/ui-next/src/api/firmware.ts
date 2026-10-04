import type { FirmwareList, FirmwareRead, FirmwareSyncResult, UploadFirmwareInput } from 'kuroshiro-shared'
import { apiGet, apiSend } from './client'

/** The Firmware library, newest first. */
export function listFirmware() {
  return apiGet<FirmwareList>('firmware')
}

/** Asks TRMNL for its newest official Firmware now. Refused with `upstream-unreachable` when TRMNL gives no answer. */
export function syncFirmware() {
  return apiSend<FirmwareSyncResult>('POST', 'firmware/sync')
}

/** Refused with `firmware-version-taken`, `device-model-unknown` or `upload-too-large`. */
export function uploadFirmware(file: File, { version, label, compatibleModels = [] }: UploadFirmwareInput) {
  const form = new FormData()
  form.set('file', file)
  form.set('version', version)
  if (label)
    form.set('label', label)
  // A multipart form has no lists, so the server reads this one as JSON.
  form.set('compatibleModels', JSON.stringify(compatibleModels))
  return apiSend<FirmwareRead>('POST', 'firmware/upload', form)
}

/** Deletes a custom Firmware and clears the target, and a pending push, of every Device that had it. */
export function deleteFirmware(firmwareId: string) {
  return apiSend('DELETE', `firmware/${firmwareId}`)
}
