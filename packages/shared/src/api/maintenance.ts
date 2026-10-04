import type { RetentionAgeKey } from './instance.js'
import type { ScreenKind } from './screens.js'

/** A leftover file, by its path below the storage folder (`devices/{deviceId}/{file}`, `uploads/{file}`). */
export interface StoredFileFinding {
  id: string
  group: 'unusedImage' | 'tempFile' | 'oldUpload'
  path: string
  bytes: number
}

export interface DeletedDeviceFolderFinding {
  id: string
  group: 'deletedDeviceFolder'
  path: string
  bytes: number
  files: number
}

export interface MissingImageFinding {
  id: string
  group: 'missingImage'
  screen: {
    id: string
    name: string
    kind: ScreenKind
    deviceId: string
    deviceName: string
    order: number
  }
}

/** One thing the stored-files check found. Its `id` is the same in every check that finds it again. */
export type StorageFinding = StoredFileFinding | DeletedDeviceFolderFinding | MissingImageFinding

export type StorageFindingGroup = StorageFinding['group']

export interface StorageCheck {
  checkedAt: string
  /** What the folders of registered Devices hold that no finding names. */
  screenImages: { files: number, bytes: number }
  findings: StorageFinding[]
}

export interface CleanupInput {
  findingIds: string[]
}

export interface CleanupResult {
  removed: { files: number, folders: number, screens: number, bytes: number }
  failed: Array<{ findingId: string, reason: string }>
}

export type RetentionAges = Record<RetentionAgeKey, number>

export interface RetentionRunResult {
  alertsPruned: number
  deviceLogsPruned: number
}

export interface RetentionLastRun extends RetentionRunResult {
  ranAt: string
}

export interface RetentionStatus {
  ages: RetentionAges
  lastRun: RetentionLastRun | null
}
