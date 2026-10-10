import type { BooleanSettingKey, SettingKey } from 'kuroshiro-shared'
import { BOOLEAN_SETTING_KEYS, SETTING_BOUNDS } from 'kuroshiro-shared'

function isBooleanSettingKey(key: SettingKey | BooleanSettingKey): key is BooleanSettingKey {
  return (BOOLEAN_SETTING_KEYS as readonly string[]).includes(key)
}

/**
 * Null when `value` is a Setting `key` could be saved with, else the reason it cannot — the
 * same rule `UpdateInstanceSettingsDto`'s decorators enforce, read from `SETTING_BOUNDS` rather
 * than a copy, so the Configuration Import and `PATCH /api/settings` can never disagree.
 */
export function settingViolation(key: SettingKey | BooleanSettingKey, value: unknown): string | null {
  if (isBooleanSettingKey(key)) {
    return typeof value === 'boolean' ? null : `${key} must be a boolean, not ${JSON.stringify(value)}`
  }

  const { min, max } = SETTING_BOUNDS[key]
  const isValid = typeof value === 'number' && Number.isInteger(value) && value >= min && (max === undefined || value <= max)
  if (isValid) {
    return null
  }
  const bound = max === undefined ? `at least ${min}` : `at least ${min} and at most ${max}`
  return `${key} must be an integer of ${bound}, not ${JSON.stringify(value)}`
}
