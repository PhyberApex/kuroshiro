import type { DeviceSummary } from 'kuroshiro-shared'
import { apiGet } from './client'

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })

/** Every Device, by name whatever its case: the order Devices are listed in everywhere. */
export async function listDevices() {
  return [...await apiGet<DeviceSummary[]>('devices')].sort(byName)
}
