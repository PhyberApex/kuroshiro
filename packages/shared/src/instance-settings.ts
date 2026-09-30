// The three Alert Rule thresholds are the first tenants of Instance Settings (ADR-0027).
export const SETTING_KEYS = ['lowBatteryPercent', 'offlineMultiplier', 'fetchFailureThreshold'] as const
export type SettingKey = typeof SETTING_KEYS[number]

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

export interface InstanceSettingValue {
  override: number | null
  value: number
  fallbackSource: FallbackSource
  fallbackValue: number
}

export type InstanceSettingsResponse = Record<SettingKey, InstanceSettingValue>

export type UpdateInstanceSettingsInput = Partial<Record<SettingKey, number | null>>
