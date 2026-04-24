export interface Device {
  id: string
  name: string
  friendlyId: string
  mac: string
  apikey: string
  batteryVoltage?: string
  fwVersion?: string
  refreshRate?: number
  rssi?: string
  userAgent?: string
  width?: number
  height?: number
  mirrorEnabled: boolean
  mirrorMac: string
  mirrorApikey: string
  specialFunction: string
  resetDevice: boolean
  updateFirmware: boolean
  lastSeen: string
}

export interface Screen {
  id: string
  type?: 'file' | 'external' | 'html' | 'plugin' | 'mashup'
  filename?: string | null
  externalLink?: string | null
  isActive: boolean
  device: string | { id: string }
  fetchManual: boolean
  html?: string | null
  plugin?: { id: string, name: string } | null
  devicePluginId?: string | null
  cachedPluginOutput?: string | null
  mashupConfiguration?: { id: string, layout: string }
}

export interface CurrentScreen {
  filename: string
  image_url: string
  refresh_rate: number
  rendered_at: string
}

export interface LogEntry {
  logId: number
  date: Date
  entry: string
}

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

export interface MaintenanceStats {
  fileCount: number
  totalSize: number
}
