// The three Alert Rule thresholds are the first tenants of Instance Settings (ADR-0027).
export const SETTING_KEYS = ['lowBatteryPercent', 'offlineMultiplier', 'fetchFailureThreshold'] as const
export type SettingKey = typeof SETTING_KEYS[number]

// The environment variable each Setting falls back to when it has no saved override.
export const SETTING_ENV_VARS: Record<SettingKey, string> = {
  lowBatteryPercent: 'KUROSHIRO_ALERT_LOW_BATTERY_PERCENT',
  offlineMultiplier: 'KUROSHIRO_ALERT_OFFLINE_MULTIPLIER',
  fetchFailureThreshold: 'KUROSHIRO_ALERT_FETCH_FAILURES',
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
