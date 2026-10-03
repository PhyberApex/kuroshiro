import type { RetentionAgeKey } from './instance.js'

export interface OrphanedScreenFile {
  deviceId: string
  screenId: string
  path: string
  size: number
}

export interface OrphanedDeviceDir {
  deviceId: string
  path: string
  fileCount: number
  size: number
}

export interface BrokenScreen {
  screenId: string
  deviceId: string
  filename: string
  type: string
}

export interface TempFile {
  path: string
  age: number
  size: number
}

export interface MaintenanceIssues {
  orphanedScreenFiles: OrphanedScreenFile[]
  orphanedDeviceDirs: OrphanedDeviceDir[]
  brokenScreens: BrokenScreen[]
  tempFiles: TempFile[]
  oldUploads: TempFile[]
  totalSize: number
  scannedAt: string
}

export interface CleanupResult {
  filesDeleted: number
  dirsDeleted: number
  screensDeleted: number
  bytesFreed: number
  errors: string[]
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
