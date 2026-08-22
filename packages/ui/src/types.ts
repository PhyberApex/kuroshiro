export interface DeviceModel {
  name: string
  label: string
  description?: string | null
  width: number
  height: number
  colors: number
  bitDepth: number
  scaleFactor: number
  rotation: number
  offsetX: number
  offsetY: number
  mimeType: string
  kind: string
  paletteIds: string[]
  cssClasses: string[]
  cssVariables: Record<string, string>
  imageSizeLimit?: number | null
  deprecated: boolean
  syncedAt?: string | null
}

export interface Palette {
  id: string
  name: string
  grays: number
  colors?: string[] | null
  frameworkClass: string
  grayscaleBitDepth?: number | null
  deprecated: boolean
  syncedAt?: string | null
}

export interface DeviceModelSyncResult {
  models: number
  palettes: number
  deprecatedModels: number
  deprecatedPalettes: number
  syncedAt: string
}

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
  reportedModel?: string | null
  deviceModel?: DeviceModel | null
  palette?: Palette | null
  mirrorEnabled: boolean
  mirrorMac: string
  mirrorApikey: string
  specialFunction: string
  resetDevice: boolean
  updateFirmware: boolean
  lastSeen: string
}

export interface Schedule {
  id: string
  enabled: boolean
  weekdays?: number[] | null
  startTime?: string | null
  endTime?: string | null
  startDate?: string | null
  endDate?: string | null
}

export interface ScheduleInput {
  enabled?: boolean
  weekdays?: number[] | null
  startTime?: string | null
  endTime?: string | null
  startDate?: string | null
  endDate?: string | null
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
  order?: number
  generatedAt?: string
  schedule?: Schedule | null
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
