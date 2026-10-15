import type { CreateDeviceInput, DeviceDetail, DeviceLogPage, DeviceLogsQuery, DeviceSummary, UpdateDeviceInput } from 'kuroshiro-shared'
import { apiGet, apiSend } from './client'

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })

/** Every Device, by name whatever its case: the order Devices are listed in everywhere. */
export async function listDevices() {
  return [...await apiGet<DeviceSummary[]>('devices')].sort(byName)
}

export function getDevice(deviceId: string) {
  return apiGet<DeviceDetail>(`devices/${deviceId}`)
}

/** Registers a Device by hand. A MAC address already registered is refused with `device-mac-taken`. */
export function createDevice(input: CreateDeviceInput) {
  return apiSend<DeviceDetail>('POST', 'devices', input)
}

export function updateDevice(deviceId: string, input: UpdateDeviceInput) {
  return apiSend<DeviceDetail>('PATCH', `devices/${deviceId}`, input)
}

/** Replaces the Device's apikey at once: its old key's next poll gets 401. Refused with `device-apikey-proxied` on a Proxied Device. */
export function regenerateApikey(deviceId: string) {
  return apiSend<DeviceDetail>('POST', `devices/${deviceId}/regenerate-apikey`)
}

/** One page of a Device Log, newest first. `after` with `limit: 0` answers only the counts of what arrived since. */
export function listDeviceLogs(deviceId: string, query: DeviceLogsQuery = {}) {
  return apiGet<DeviceLogPage>(`devices/${deviceId}/logs`, { ...query })
}

export function clearDeviceLogs(deviceId: string) {
  return apiSend('DELETE', `devices/${deviceId}/logs`)
}

export function deleteDevice(deviceId: string) {
  return apiSend('DELETE', `devices/${deviceId}`)
}

function asUpload(file: File) {
  const upload = new FormData()
  upload.append('file', file)
  return upload
}

/** Uploads the Device's sleep image, replacing one already stored. Refused with `image-unreadable`, `upload-too-large` or `demo-mode`. */
export function uploadSleepImage(deviceId: string, file: File) {
  return apiSend<DeviceDetail>('PUT', `devices/${deviceId}/sleep-image`, asUpload(file))
}

/** Removes the Device's sleep image; Sleep Mode then shows the sleep Fallback Screen again. */
export function removeSleepImage(deviceId: string) {
  return apiSend<DeviceDetail>('DELETE', `devices/${deviceId}/sleep-image`)
}
