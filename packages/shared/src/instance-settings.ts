// The three Alert Rule thresholds are the first tenants of Instance Settings (ADR-0027).
export const ALERT_THRESHOLD_KEYS = ['lowBatteryPercent', 'offlineMultiplier', 'fetchFailureThreshold'] as const
export type AlertThresholdKey = typeof ALERT_THRESHOLD_KEYS[number]

// The two Retention ages, in days; 0 disables pruning for that age.
export const RETENTION_AGE_KEYS = ['alertRetentionDays', 'deviceLogRetentionDays'] as const
export type RetentionAgeKey = typeof RETENTION_AGE_KEYS[number]

// Every numeric Setting: each resolves as override, else its environment variable, else the built-in default.
export const SETTING_KEYS = [...ALERT_THRESHOLD_KEYS, ...RETENTION_AGE_KEYS] as const
export type SettingKey = typeof SETTING_KEYS[number]

// Firmware Auto-Update (ADR-0029) is the first boolean Setting; unlike the numeric
// Settings it has no environment-variable fallback, only the built-in default.
export const BOOLEAN_SETTING_KEYS = ['firmwareAutoUpdate'] as const
export type BooleanSettingKey = typeof BOOLEAN_SETTING_KEYS[number]

// The environment variable each Setting falls back to when it has no saved override.
export const SETTING_ENV_VARS: Record<SettingKey, string> = {
  lowBatteryPercent: 'KUROSHIRO_ALERT_LOW_BATTERY_PERCENT',
  offlineMultiplier: 'KUROSHIRO_ALERT_OFFLINE_MULTIPLIER',
  fetchFailureThreshold: 'KUROSHIRO_ALERT_FETCH_FAILURES',
  alertRetentionDays: 'KUROSHIRO_ALERT_RETENTION_DAYS',
  deviceLogRetentionDays: 'KUROSHIRO_DEVICE_LOG_RETENTION_DAYS',
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
  alertRetentionDays: { min: 0 },
  deviceLogRetentionDays: { min: 0 },
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
