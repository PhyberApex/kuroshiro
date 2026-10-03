// The three Alert Rule thresholds are the first tenants of Instance Settings (ADR-0027).
export const SETTING_KEYS = ['lowBatteryPercent', 'offlineMultiplier', 'fetchFailureThreshold'] as const
export type SettingKey = typeof SETTING_KEYS[number]

// Firmware Auto-Update (ADR-0029) is the first boolean Setting; unlike the numeric
// thresholds it has no environment-variable fallback, only the built-in default.
export const BOOLEAN_SETTING_KEYS = ['firmwareAutoUpdate'] as const
export type BooleanSettingKey = typeof BOOLEAN_SETTING_KEYS[number]

// The environment variable each Setting falls back to when it has no saved override.
export const SETTING_ENV_VARS: Record<SettingKey, string> = {
  lowBatteryPercent: 'KUROSHIRO_ALERT_LOW_BATTERY_PERCENT',
  offlineMultiplier: 'KUROSHIRO_ALERT_OFFLINE_MULTIPLIER',
  fetchFailureThreshold: 'KUROSHIRO_ALERT_FETCH_FAILURES',
}

export interface SettingBounds {
  min: number
  max?: number
}

// Validated on save; environment-variable parsing itself stays as lenient as it was before Instance Settings.
// Shared so the UI's number fields carry the same min/max as the API's DTO decorators (ADR-0020) rather than
// hand-copying them and risking drift.
export const SETTING_BOUNDS: Record<SettingKey, SettingBounds> = {
  lowBatteryPercent: { min: 1, max: 100 },
  offlineMultiplier: { min: 2 },
  fetchFailureThreshold: { min: 1 },
}

export type FallbackSource = 'env' | 'default'

export interface InstanceSettingValue<T = number> {
  override: T | null
  value: T
  fallbackSource: FallbackSource
  fallbackValue: T
}

export interface InstanceSettingsResponse extends Record<SettingKey, InstanceSettingValue>, Record<BooleanSettingKey, InstanceSettingValue<boolean>> {}

export type UpdateInstanceSettingsInput = Partial<Record<SettingKey, number | null>> & Partial<Record<BooleanSettingKey, boolean | null>>

export interface InstanceLimits {
  imageUploadBytes: number
  firmwareUploadBytes: number
  archiveUploadBytes: number
  pluginImportBytes: number
  webhookBodyBytes: number
}

export interface InstanceFacts {
  version: string
  serverUrl: string
  serverUrlIsLoopback: boolean
  timezone: string
  demoMode: boolean
  notifications: {
    configured: boolean
    appriseUrl: string | null
  }
  limits: InstanceLimits
}
