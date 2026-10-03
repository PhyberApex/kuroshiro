export type FirmwareKind = 'official-synced' | 'custom'

/** What a sync with TRMNL records, one record per kind. */
export const SYNC_KINDS = ['firmware', 'device-models'] as const
export type SyncKind = typeof SYNC_KINDS[number]

/** The last sync with TRMNL of one kind, whether it worked or not. */
export interface SyncRun {
  ranAt: string
  ok: boolean
  /** The reason a failed sync gave; `null` when it worked. */
  error: string | null
}

export interface DeviceReference {
  id: string
  name: string
}

export interface FirmwareTarget extends DeviceReference {
  pushPending: boolean
}

export interface FirmwareRead {
  id: string
  version: string
  kind: FirmwareKind
  label: string | null
  /** Empty: every Device Model. */
  compatibleModels: string[]
  deprecated: boolean
  syncedAt: string | null
  uploadedAt: string | null
  /** The binary is on disk. */
  filePresent: boolean
  /** The Devices that have this Firmware as their target. */
  targetOf: FirmwareTarget[]
  /** The Devices reporting this version. */
  runningOn: DeviceReference[]
}

export interface FirmwareList {
  lastSync: SyncRun | null
  /** Newest first. */
  firmware: FirmwareRead[]
}

export interface FirmwareSyncResult {
  ranAt: string
  /** A Firmware TRMNL newly published was stored; `false` when the newest one was already here. */
  inserted: boolean
  version: string
  /** The Devices Firmware Auto-Update gave the new Firmware to; empty when it is off or nothing was new. */
  assigned: DeviceReference[]
}

export interface UploadFirmwareInput {
  version: string
  label?: string
  /** Device Model names; omitted or empty: every Device Model. */
  compatibleModels?: string[]
}
