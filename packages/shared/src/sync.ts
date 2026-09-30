export interface DeviceModelSyncResult {
  models: number
  palettes: number
  deprecatedModels: number
  deprecatedPalettes: number
  syncedAt: string
}

export interface FirmwareSyncResult {
  inserted: boolean
  version: string
  syncedAt?: string
  /** Devices auto-assigned this Firmware by the Firmware Auto-Update policy (ADR-0029); present only when `inserted` is true. */
  assignedCount?: number
}
