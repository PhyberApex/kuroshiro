import type { BooleanSettingKey, FallbackSource, InstanceSettingsResponse, InstanceSettingValue, SettingKey } from 'kuroshiro-shared'
import type { InstanceSettings } from './entities/instance-settings.entity.js'
import { BOOLEAN_SETTING_KEYS, SETTING_KEYS } from 'kuroshiro-shared'

interface SettingFallback<T> {
  value: T
  source: FallbackSource
}

export type InstanceSettingsFallbacks = Record<SettingKey, SettingFallback<number>> & Record<BooleanSettingKey, SettingFallback<boolean>>

function toInstanceSettingValue<T>(override: T | null, fallback: SettingFallback<T>): InstanceSettingValue<T> {
  return { override, value: override ?? fallback.value, fallbackSource: fallback.source, fallbackValue: fallback.value }
}

export function toInstanceSettingsResponse(row: InstanceSettings | null, fallbacks: InstanceSettingsFallbacks): InstanceSettingsResponse {
  const thresholds = Object.fromEntries(SETTING_KEYS.map(key =>
    [key, toInstanceSettingValue(row?.[key] ?? null, fallbacks[key])],
  )) as Record<SettingKey, InstanceSettingValue>
  const booleans = Object.fromEntries(BOOLEAN_SETTING_KEYS.map(key =>
    [key, toInstanceSettingValue(row?.[key] ?? null, fallbacks[key])],
  )) as Record<BooleanSettingKey, InstanceSettingValue<boolean>>
  return { ...thresholds, ...booleans }
}
