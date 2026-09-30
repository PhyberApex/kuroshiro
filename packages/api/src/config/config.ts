import type { FallbackSource } from 'kuroshiro-shared'
import process from 'node:process'
import { SETTING_ENV_VARS } from 'kuroshiro-shared'

const DEFAULT_LOW_BATTERY_PERCENT = 20
const DEFAULT_OFFLINE_MULTIPLIER = 3
const DEFAULT_FETCH_FAILURE_THRESHOLD = 3
const DEFAULT_ALERT_RETENTION_DAYS = 90
const DEFAULT_DEVICE_LOG_RETENTION_DAYS = 30

interface ParsedIntEnv {
  value: number
  source: FallbackSource
}

/** Falls back to `defaultValue` (with a logged warning) for an unset or non-numeric env var — reports whether the env var or the default actually won, for Instance Settings (ADR-0027) to show as a Setting's fallback source. */
function parseIntEnv(name: string, defaultValue: number): ParsedIntEnv {
  const raw = process.env[name]
  if (!raw)
    return { value: defaultValue, source: 'default' }
  const parsed = Number.parseInt(raw, 10)
  if (Number.isNaN(parsed)) {
    console.warn(`${name} is not a valid number ("${raw}"), falling back to ${defaultValue}`)
    return { value: defaultValue, source: 'default' }
  }
  return { value: parsed, source: 'env' }
}

export default () => {
  const lowBatteryPercent = parseIntEnv(SETTING_ENV_VARS.lowBatteryPercent, DEFAULT_LOW_BATTERY_PERCENT)
  const offlineMultiplier = parseIntEnv(SETTING_ENV_VARS.offlineMultiplier, DEFAULT_OFFLINE_MULTIPLIER)
  const fetchFailureThreshold = parseIntEnv(SETTING_ENV_VARS.fetchFailureThreshold, DEFAULT_FETCH_FAILURE_THRESHOLD)

  return {
    port: Number.parseInt(process.env.KUROSHIRO_PORT || '', 10) || 3000,
    api_url: process.env.KUROSHIRO_API_URL || 'http://localhost:5173',
    demo_mode: process.env.KUROSHIRO_DEMO_MODE === 'true' || false,
    database: {
      host: process.env.KUROSHIRO_DB_HOST || 'localhost',
      port: Number.parseInt(process.env.KUROSHIRO_DB_PORT || '5432', 10),
      database: process.env.KUROSHIRO_DB_DB || 'test',
      user: process.env.KUROSHIRO_DB_USER || 'root',
      password: process.env.KUROSHIRO_DB_PASSWORD || 'root',
    },
    alerts: {
      appriseUrl: process.env.KUROSHIRO_APPRISE_URL || undefined,
      appriseKey: process.env.KUROSHIRO_APPRISE_KEY || 'kuroshiro',
      lowBatteryPercent: lowBatteryPercent.value,
      lowBatteryPercentSource: lowBatteryPercent.source,
      offlineMultiplier: offlineMultiplier.value,
      offlineMultiplierSource: offlineMultiplier.source,
      fetchFailureThreshold: fetchFailureThreshold.value,
      fetchFailureThresholdSource: fetchFailureThreshold.source,
    },
    retention: {
      alertRetentionDays: parseIntEnv('KUROSHIRO_ALERT_RETENTION_DAYS', DEFAULT_ALERT_RETENTION_DAYS).value,
      deviceLogRetentionDays: parseIntEnv('KUROSHIRO_DEVICE_LOG_RETENTION_DAYS', DEFAULT_DEVICE_LOG_RETENTION_DAYS).value,
    },
  }
}
