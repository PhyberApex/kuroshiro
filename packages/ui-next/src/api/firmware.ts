import type { FirmwareList } from 'kuroshiro-shared'
import { apiGet } from './client'

/** The Firmware library, newest first. */
export function listFirmware() {
  return apiGet<FirmwareList>('firmware')
}
