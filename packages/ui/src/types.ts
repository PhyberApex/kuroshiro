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

export interface Firmware {
  id: string
  version: string
  kind: 'official-synced' | 'custom'
  checksum: string
  compatibleModels: string[]
  deprecated: boolean
  label?: string | null
  syncedAt?: string | null
  uploadedAt?: string | null
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
  sleepModeEnabled: boolean
  sleepStartTime?: number | null
  sleepEndTime?: number | null
  sleepScreenEnabled: boolean
  resetDevice: boolean
  updateFirmware: boolean
  targetFirmware?: Firmware | null
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

export interface DeviceStatusStamp {
  wifi_rssi_level: number
  battery_voltage: number
  current_fw_version: string
  free_heap_size: number
  wakeup_reason: string
  wifi_status: string
}

export type AdditionalInfoMap = Record<string, string | number | null | undefined>

export interface ParsedDeviceLogPayload {
  log_message?: string
  log_sourcefile?: string
  log_codeline?: number
  device_status_stamp?: DeviceStatusStamp
  additional_info?: AdditionalInfoMap
}

export interface MaintenanceStats {
  fileCount: number
  totalSize: number
}
