import type { SensorReading } from '../sensor'

export const SPECIAL_FUNCTIONS = ['identify', 'sleep', 'add_wifi', 'restart_playlist', 'rewind', 'send_to_me'] as const
export type SpecialFunction = typeof SPECIAL_FUNCTIONS[number]

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
