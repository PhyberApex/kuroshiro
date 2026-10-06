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

/** Rotates the Device's API key at once. Refused with 409 `device-proxied` on a Proxied Device. */
export function regenerateApikey(deviceId: string) {
  return apiSend<DeviceDetail>('POST', `devices/${deviceId}/apikey`)
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
