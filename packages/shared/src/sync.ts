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
}
