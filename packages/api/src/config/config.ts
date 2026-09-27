import process from 'node:process'

const DEFAULT_LOW_BATTERY_PERCENT = 20
const DEFAULT_OFFLINE_MULTIPLIER = 3

/** Falls back to `defaultValue` (with a logged warning) for an unset or non-numeric env var. */
function parseIntEnv(name: string, defaultValue: number): number {
  const raw = process.env[name]
  if (!raw)
    return defaultValue
  const parsed = Number.parseInt(raw, 10)
  if (Number.isNaN(parsed)) {
    console.warn(`${name} is not a valid number ("${raw}"), falling back to ${defaultValue}`)
    return defaultValue
  }
  return parsed
}

export default () => ({
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
    lowBatteryPercent: parseIntEnv('KUROSHIRO_ALERT_LOW_BATTERY_PERCENT', DEFAULT_LOW_BATTERY_PERCENT),
    offlineMultiplier: parseIntEnv('KUROSHIRO_ALERT_OFFLINE_MULTIPLIER', DEFAULT_OFFLINE_MULTIPLIER),
  },
})
