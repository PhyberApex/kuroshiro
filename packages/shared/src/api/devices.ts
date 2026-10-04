import type { SensorReading } from '../sensor'

export const SPECIAL_FUNCTIONS = ['identify', 'sleep', 'add_wifi', 'restart_playlist', 'rewind', 'send_to_me'] as const
export type SpecialFunction = typeof SPECIAL_FUNCTIONS[number]

export const MAC_ADDRESS_PATTERN = /^(?:[0-9A-F]{2}:){5}[0-9A-F]{2}$/i

/** Seconds. */
export const REFRESH_RATE_MIN = 60
export const REFRESH_RATE_MAX = 86400

export type FallbackKind = 'welcome' | 'noScreen' | 'error' | 'sleep'
export type FallbackReason = 'neverPolled' | 'noScreens' | 'noneEligible' | 'renderFailed' | 'mirrorFailed' | 'asleep'

export interface CurrentScreenOfRotation {
  kind: 'screen'
  screenId: string
  name: string
  imagePath: string
  renderedAt: string | null
  servedAt: string
  /** Sleep Mode is in its window and keeps this image on the Device. */
  paused: boolean
  /** A hold Render Signal keeps this image on the Device. */
  holding: boolean
}

export interface CurrentFallbackScreen {
  kind: 'fallback'
  fallback: FallbackKind
  reason: FallbackReason
  /** The Screen that could not be rendered, for `renderFailed`. */
  screenId: string | null
  imagePath: string
  servedAt: string | null
}

export interface CurrentMirroredScreen {
  kind: 'mirror'
  proxied: boolean
  mirrorMac: string
  imagePath: string
  fetchedAt: string
}

/** What the Device shows: what its last poll was answered with, or the welcome Fallback Screen before its first. */
export type CurrentScreen = CurrentScreenOfRotation | CurrentFallbackScreen | CurrentMirroredScreen

export interface SleepState {
  enabled: boolean
  /** `HH:MM` in the server's timezone. */
  start: string | null
  end: string | null
  whileAsleep: 'fallback' | 'keep'
  /** Always false on a mirrored Device, which Sleep Mode does not apply to. */
  inWindow: boolean
  endsAt: string | null
}

export interface DeviceModelReference {
  name: string
  label: string
  width: number
  height: number
  deprecated: boolean
}

export interface DeviceSummary {
  id: string
  name: string
  friendlyId: string
  firmwareVersion: string | null
  deviceModel: DeviceModelReference | null
  lastSeenAt: string | null
  /** The last poll's time plus the refresh rate that poll was given; `null` before the first poll. */
  nextPollAt: string | null
  batteryPercent: number | null
  rssi: number | null
  isMirrored: boolean
  isProxied: boolean
  sleep: SleepState
  currentScreen: CurrentScreen
}

export interface DeviceDetail extends DeviceSummary {
  mac: string
  apikey: string
  refreshRate: number
  reported: {
    batteryVoltage: string | null
    rssi: string | null
    firmwareVersion: string | null
    model: string | null
    width: number | null
    height: number | null
  }
  palette: { id: string, name: string, kind: 'official' | 'custom' } | null
  mirror: { enabled: boolean, mac: string | null, apikeySet: boolean }
  targetFirmware: { id: string, version: string, kind: 'official-synced' | 'custom', label: string | null, deprecated: boolean } | null
  pending: { specialFunction: SpecialFunction | null, deviceReset: boolean, firmwarePush: boolean }
  sleepImagePath: string | null
  sensors: SensorReading[]
  screenCount: number
}

export interface CreateDeviceInput {
  /** Non-empty after trim. */
  name: string
  /** Matches `MAC_ADDRESS_PATTERN`. Stored upper-case. */
  mac: string
}

/** Every key is optional: an absent key leaves its field alone. `null` clears a nullable field. */
export interface UpdateDeviceInput {
  /** Non-empty after trim. */
  name?: string
  /** Integer seconds, `REFRESH_RATE_MIN` to `REFRESH_RATE_MAX`. */
  refreshRate?: number
  /** Changing it resets the Palette to the Device Model's richest one unless `paletteId` is sent too. */
  deviceModelName?: string
  paletteId?: string
  sleepModeEnabled?: boolean
  /** Seconds of day, 0 to 86399. */
  sleepStartTime?: number | null
  sleepEndTime?: number | null
  sleepScreenEnabled?: boolean
  mirrorEnabled?: boolean
  /** Stored upper-case. */
  mirrorMac?: string
  /** Write-only: `DeviceDetail.mirror.apikeySet` says whether one is stored. */
  mirrorApikey?: string
  specialFunction?: SpecialFunction | 'none'
  resetDevice?: boolean
  /** `null` clears the target, refused with 409 `firmware-push-pending` while a push is pending. */
  targetFirmwareId?: string | null
  /** `true` is refused with 409 `firmware-push-without-target` or `firmware-push-mirrored`. */
  updateFirmware?: boolean
}

export const LOG_LEVELS = ['error', 'warning', 'info', 'debug'] as const
export type LogLevel = typeof LOG_LEVELS[number]

export interface DeviceLogSource {
  file: string
  line: number | null
}

/** What the Device said about itself with the entry. `null` is a fact it did not send. */
export interface DeviceLogStatus {
  wifiRssi: number | null
  wifiStatus: string | null
  batteryVoltage: number | null
  freeHeapSize: number | null
  wakeReason: string | null
}

export interface DeviceLogEntry {
  id: string
  at: string
  level: LogLevel
  message: string
  source: DeviceLogSource | null
  status: DeviceLogStatus | null
  firmwareVersion: string | null
  /** Every further field the firmware sent, under the firmware's own name. */
  extras: Record<string, unknown>
}

export interface DeviceLogPage {
  /** Newest first. */
  entries: DeviceLogEntry[]
  /** Every entry of the Device Log. */
  total: number
  /** The entries `level` and `q` match; with `after`, only those newer than it. */
  matching: number
  /** Pass as `before` for the next page; `null` at the end. */
  nextCursor: string | null
  /** The newest entry of the Device Log. Pass as `after` to count or load what arrived since; `null` while the Device Log is empty. */
  newestCursor: string | null
}

export const DEVICE_LOG_LEVEL_FILTERS = ['all', 'problems'] as const
/** `problems` is `error` and `warning`. */
export type DeviceLogLevelFilter = typeof DEVICE_LOG_LEVEL_FILTERS[number]

export const DEVICE_LOG_PAGE_SIZE = 50
export const DEVICE_LOG_PAGE_SIZE_MAX = 200
export const DEVICE_LOG_SEARCH_MIN_LENGTH = 2

export interface DeviceLogsQuery {
  /** 0 to `DEVICE_LOG_PAGE_SIZE_MAX`, `DEVICE_LOG_PAGE_SIZE` when absent. 0 answers the counts and no entry. */
  limit?: number
  /** A cursor: only entries older than it. */
  before?: string
  /** A cursor: only entries newer than it. */
  after?: string
  level?: DeviceLogLevelFilter
  /** At least `DEVICE_LOG_SEARCH_MIN_LENGTH` characters, matched against the message whatever its case. */
  q?: string
}
