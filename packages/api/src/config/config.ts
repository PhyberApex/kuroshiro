import type { FallbackSource } from 'kuroshiro-shared'
import process from 'node:process'
import { SETTING_ENV_VARS } from 'kuroshiro-shared'

const DEFAULT_LOW_BATTERY_PERCENT = 20
const DEFAULT_OFFLINE_MULTIPLIER = 3
const DEFAULT_FETCH_FAILURE_THRESHOLD = 3
const DEFAULT_ALERT_RETENTION_DAYS = 90
const DEFAULT_DEVICE_LOG_RETENTION_DAYS = 30

const ENV_VARS = {
  port: 'KUROSHIRO_PORT',
  apiUrl: 'KUROSHIRO_API_URL',
  demoMode: 'KUROSHIRO_DEMO_MODE',
  dbHost: 'KUROSHIRO_DB_HOST',
  dbPort: 'KUROSHIRO_DB_PORT',
  dbName: 'KUROSHIRO_DB_DB',
  dbUser: 'KUROSHIRO_DB_USER',
  dbPassword: 'KUROSHIRO_DB_PASSWORD',
  appriseUrl: 'KUROSHIRO_APPRISE_URL',
  appriseKey: 'KUROSHIRO_APPRISE_KEY',
} as const

const KNOWN_ENV_VARS = new Set<string>([...Object.values(ENV_VARS), ...Object.values(SETTING_ENV_VARS)])

const RENAMED_ENV_VARS: Record<string, string> = {
  KUROSHIRO_POSTGRES_PORT: ENV_VARS.dbPort,
  KUROSHIRO_POSTGRES_USER: ENV_VARS.dbUser,
  KUROSHIRO_POSTGRES_PASSWORD: ENV_VARS.dbPassword,
  KUROSHIRO_POSTGRES_DB: ENV_VARS.dbName,
  KUROSHIRO_API_PORT: ENV_VARS.port,
}

function unknownEnvVarWarning(name: string): string {
  const ignored = `${name} is set but Kuroshiro does not read it; it is ignored`
  const replacement = RENAMED_ENV_VARS[name]
  return replacement ? `${ignored}. Use ${replacement} instead` : ignored
}

/** Lists one warning per `KUROSHIRO_*` variable in `env` that no setting reads, since a misspelt or outdated name otherwise silently falls back to the default. */
export function unknownEnvVarWarnings(env: Record<string, string | undefined>): string[] {
  return Object.keys(env)
    .filter(name => name.startsWith('KUROSHIRO_') && !KNOWN_ENV_VARS.has(name))
    .map(unknownEnvVarWarning)
}

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
  const alertRetentionDays = parseIntEnv(SETTING_ENV_VARS.alertRetentionDays, DEFAULT_ALERT_RETENTION_DAYS)
  const deviceLogRetentionDays = parseIntEnv(SETTING_ENV_VARS.deviceLogRetentionDays, DEFAULT_DEVICE_LOG_RETENTION_DAYS)

  return {
    port: Number.parseInt(process.env[ENV_VARS.port] || '', 10) || 3000,
    api_url: process.env[ENV_VARS.apiUrl] || 'http://localhost:5173',
    demo_mode: process.env[ENV_VARS.demoMode] === 'true' || false,
    database: {
      host: process.env[ENV_VARS.dbHost] || 'localhost',
      port: Number.parseInt(process.env[ENV_VARS.dbPort] || '5432', 10),
      database: process.env[ENV_VARS.dbName] || 'test',
      user: process.env[ENV_VARS.dbUser] || 'root',
      password: process.env[ENV_VARS.dbPassword] || 'root',
    },
    alerts: {
      appriseUrl: process.env[ENV_VARS.appriseUrl] || undefined,
      appriseKey: process.env[ENV_VARS.appriseKey] || 'kuroshiro',
      lowBatteryPercent: lowBatteryPercent.value,
      lowBatteryPercentSource: lowBatteryPercent.source,
      offlineMultiplier: offlineMultiplier.value,
      offlineMultiplierSource: offlineMultiplier.source,
      fetchFailureThreshold: fetchFailureThreshold.value,
      fetchFailureThresholdSource: fetchFailureThreshold.source,
    },
    retention: {
      alertRetentionDays: alertRetentionDays.value,
      alertRetentionDaysSource: alertRetentionDays.source,
      deviceLogRetentionDays: deviceLogRetentionDays.value,
      deviceLogRetentionDaysSource: deviceLogRetentionDays.source,
    },
  }
}
