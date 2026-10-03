import type { BooleanSettingKey, FallbackSource, InstanceSettingsResponse, InstanceSettingValue, SettingKey } from 'kuroshiro-shared'
import type { InstanceSettings } from './entities/instance-settings.entity.js'
import { BOOLEAN_SETTING_KEYS, SETTING_KEYS } from 'kuroshiro-shared'

export type InstanceSettingsFallbacks = Record<SettingKey, { value: number, source: FallbackSource }>

function toSettingValue<T>(override: T | null, fallbackValue: T, fallbackSource: FallbackSource): InstanceSettingValue<T> {
  return { override, value: override ?? fallbackValue, fallbackSource, fallbackValue }
}

export function toInstanceSettingsResponse(row: InstanceSettings | null, fallbacks: InstanceSettingsFallbacks): InstanceSettingsResponse {
  const thresholds = Object.fromEntries(SETTING_KEYS.map(key =>
    [key, toSettingValue(row?.[key] ?? null, fallbacks[key].value, fallbacks[key].source)],
  )) as Record<SettingKey, InstanceSettingValue>
  const booleans = Object.fromEntries(BOOLEAN_SETTING_KEYS.map(key =>
    [key, toSettingValue(row?.[key] ?? null, false, 'default')],
  )) as Record<BooleanSettingKey, InstanceSettingValue<boolean>>
  return { ...thresholds, ...booleans }
}
