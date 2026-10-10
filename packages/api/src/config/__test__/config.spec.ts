import process from 'node:process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import config, { unknownEnvVarWarnings } from '../config.js'

const ENV_KEYS = [
  'KUROSHIRO_PORT',
  'KUROSHIRO_API_URL',
  'KUROSHIRO_DEMO_MODE',
  'KUROSHIRO_DB_HOST',
  'KUROSHIRO_DB_PORT',
  'KUROSHIRO_DB_DB',
  'KUROSHIRO_DB_USER',
  'KUROSHIRO_DB_PASSWORD',
  'KUROSHIRO_APPRISE_URL',
  'KUROSHIRO_APPRISE_KEY',
  'KUROSHIRO_ALERT_LOW_BATTERY_PERCENT',
  'KUROSHIRO_ALERT_OFFLINE_MULTIPLIER',
  'KUROSHIRO_ALERT_FETCH_FAILURES',
  'KUROSHIRO_ALERT_RETENTION_DAYS',
  'KUROSHIRO_DEVICE_LOG_RETENTION_DAYS',
  'KUROSHIRO_ALERT_SWEEP_CRON',
] as const

describe('config', () => {
  let originalEnv: Record<string, string | undefined>

  beforeEach(() => {
    originalEnv = Object.fromEntries(ENV_KEYS.map(key => [key, process.env[key]]))
    ENV_KEYS.forEach(key => delete process.env[key])
  })

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (originalEnv[key] === undefined)
        delete process.env[key]
      else
        process.env[key] = originalEnv[key]
    }
  })

  it('falls back to defaults when no env vars are set', () => {
    expect(config()).toEqual({
      port: 3000,
      api_url: 'http://localhost:5173',
      demo_mode: false,
      database: {
        host: 'localhost',
        port: 5432,
        database: 'test',
        user: 'root',
        password: 'root',
      },
      alerts: {
        appriseUrl: undefined,
        appriseKey: 'kuroshiro',
        lowBatteryPercent: 20,
        lowBatteryPercentSource: 'default',
        offlineMultiplier: 3,
        offlineMultiplierSource: 'default',
        fetchFailureThreshold: 3,
        fetchFailureThresholdSource: 'default',
        sweepCron: '*/5 * * * *',
      },
      retention: {
        alertRetentionDays: 90,
        alertRetentionDaysSource: 'default',
        deviceLogRetentionDays: 30,
        deviceLogRetentionDaysSource: 'default',
      },
    })
  })

  it('reads every value from its env var override', () => {
    process.env.KUROSHIRO_PORT = '8080'
    process.env.KUROSHIRO_API_URL = 'https://app.example.com'
    process.env.KUROSHIRO_DEMO_MODE = 'true'
    process.env.KUROSHIRO_DB_HOST = 'db.example.com'
    process.env.KUROSHIRO_DB_PORT = '5433'
    process.env.KUROSHIRO_DB_DB = 'kuroshiro'
    process.env.KUROSHIRO_DB_USER = 'kuroshiro_user'
    process.env.KUROSHIRO_DB_PASSWORD = 'secret'
    process.env.KUROSHIRO_APPRISE_URL = 'http://apprise:8000'
    process.env.KUROSHIRO_APPRISE_KEY = 'my-key'
    process.env.KUROSHIRO_ALERT_LOW_BATTERY_PERCENT = '15'
    process.env.KUROSHIRO_ALERT_OFFLINE_MULTIPLIER = '5'
    process.env.KUROSHIRO_ALERT_FETCH_FAILURES = '4'
    process.env.KUROSHIRO_ALERT_RETENTION_DAYS = '120'
    process.env.KUROSHIRO_DEVICE_LOG_RETENTION_DAYS = '14'
    process.env.KUROSHIRO_ALERT_SWEEP_CRON = '*/5 * * * * *'

    expect(config()).toEqual({
      port: 8080,
      api_url: 'https://app.example.com',
      demo_mode: true,
      database: {
        host: 'db.example.com',
        port: 5433,
        database: 'kuroshiro',
        user: 'kuroshiro_user',
        password: 'secret',
      },
      alerts: {
        appriseUrl: 'http://apprise:8000',
        appriseKey: 'my-key',
        lowBatteryPercent: 15,
        lowBatteryPercentSource: 'env',
        offlineMultiplier: 5,
        offlineMultiplierSource: 'env',
        fetchFailureThreshold: 4,
        fetchFailureThresholdSource: 'env',
        sweepCron: '*/5 * * * * *',
      },
      retention: {
        alertRetentionDays: 120,
        alertRetentionDaysSource: 'env',
        deviceLogRetentionDays: 14,
        deviceLogRetentionDaysSource: 'env',
      },
    })
  })

  it('falls back to port 3000 when KUROSHIRO_PORT is not set', () => {
    expect(config().port).toBe(3000)
  })

  it('falls back to port 3000 when KUROSHIRO_PORT is non-numeric', () => {
    process.env.KUROSHIRO_PORT = 'not-a-number'
    expect(config().port).toBe(3000)
  })

  it('only enables demo mode for the literal string "true"', () => {
    process.env.KUROSHIRO_DEMO_MODE = 'false'
    expect(config().demo_mode).toBe(false)

    process.env.KUROSHIRO_DEMO_MODE = 'yes'
    expect(config().demo_mode).toBe(false)

    process.env.KUROSHIRO_DEMO_MODE = 'true'
    expect(config().demo_mode).toBe(true)
  })

  it('has no Apprise URL configured by default, meaning notifications are off', () => {
    expect(config().alerts.appriseUrl).toBeUndefined()
  })

  it('defaults the Apprise config key to "kuroshiro"', () => {
    expect(config().alerts.appriseKey).toBe('kuroshiro')
  })

  it('falls back to defaults and logs a warning when the alert thresholds are non-numeric', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    process.env.KUROSHIRO_ALERT_LOW_BATTERY_PERCENT = 'not-a-number'
    process.env.KUROSHIRO_ALERT_OFFLINE_MULTIPLIER = 'also-not-a-number'
    process.env.KUROSHIRO_ALERT_FETCH_FAILURES = 'still-not-a-number'

    expect(config().alerts).toEqual({
      appriseUrl: undefined,
      appriseKey: 'kuroshiro',
      lowBatteryPercent: 20,
      lowBatteryPercentSource: 'default',
      offlineMultiplier: 3,
      offlineMultiplierSource: 'default',
      fetchFailureThreshold: 3,
      fetchFailureThresholdSource: 'default',
      sweepCron: '*/5 * * * *',
    })
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('KUROSHIRO_ALERT_LOW_BATTERY_PERCENT'))
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('KUROSHIRO_ALERT_OFFLINE_MULTIPLIER'))
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('KUROSHIRO_ALERT_FETCH_FAILURES'))

    warnSpy.mockRestore()
  })

  it('defaults the Alert Sweep schedule to every 5 minutes', () => {
    expect(config().alerts.sweepCron).toBe('*/5 * * * *')
  })

  it('falls back to the default Alert Sweep schedule and logs a warning when the cron expression is invalid', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    process.env.KUROSHIRO_ALERT_SWEEP_CRON = 'not-a-cron-expression'

    expect(config().alerts.sweepCron).toBe('*/5 * * * *')
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('KUROSHIRO_ALERT_SWEEP_CRON'))

    warnSpy.mockRestore()
  })

  it('defaults retention to 90 days for Alerts and 30 days for Device Logs', () => {
    expect(config().retention).toEqual({
      alertRetentionDays: 90,
      alertRetentionDaysSource: 'default',
      deviceLogRetentionDays: 30,
      deviceLogRetentionDaysSource: 'default',
    })
  })

  it('allows retention ages to be set to 0 to disable pruning', () => {
    process.env.KUROSHIRO_ALERT_RETENTION_DAYS = '0'
    process.env.KUROSHIRO_DEVICE_LOG_RETENTION_DAYS = '0'

    expect(config().retention).toEqual({
      alertRetentionDays: 0,
      alertRetentionDaysSource: 'env',
      deviceLogRetentionDays: 0,
      deviceLogRetentionDaysSource: 'env',
    })
  })

  it('falls back to defaults and logs a warning when the retention ages are non-numeric', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    process.env.KUROSHIRO_ALERT_RETENTION_DAYS = 'not-a-number'
    process.env.KUROSHIRO_DEVICE_LOG_RETENTION_DAYS = 'also-not-a-number'

    expect(config().retention).toEqual({
      alertRetentionDays: 90,
      alertRetentionDaysSource: 'default',
      deviceLogRetentionDays: 30,
      deviceLogRetentionDaysSource: 'default',
    })
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('KUROSHIRO_ALERT_RETENTION_DAYS'))
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('KUROSHIRO_DEVICE_LOG_RETENTION_DAYS'))

    warnSpy.mockRestore()
  })
})

describe('unknownEnvVarWarnings', () => {
  it('names a KUROSHIRO_ variable the config does not read', () => {
    expect(unknownEnvVarWarnings({ KUROSHIRO_DB_HOSTNAME: 'db' })).toEqual([
      'KUROSHIRO_DB_HOSTNAME is set but Kuroshiro does not read it; it is ignored',
    ])
  })

  it('stays quiet for every variable the config reads and for variables outside the KUROSHIRO_ prefix', () => {
    const env = Object.fromEntries([...ENV_KEYS, 'NODE_ENV', 'POSTGRES_USER'].map(name => [name, 'set']))

    expect(unknownEnvVarWarnings(env)).toEqual([])
  })

  it('names the replacement of a variable an older Kuroshiro read', () => {
    expect(unknownEnvVarWarnings({
      KUROSHIRO_POSTGRES_USER: 'root',
      KUROSHIRO_POSTGRES_PASSWORD: 'root',
      KUROSHIRO_POSTGRES_DB: 'kuroshiro',
      KUROSHIRO_POSTGRES_PORT: '5432',
      KUROSHIRO_API_PORT: '3000',
    })).toEqual([
      'KUROSHIRO_POSTGRES_USER is set but Kuroshiro does not read it; it is ignored. Use KUROSHIRO_DB_USER instead',
      'KUROSHIRO_POSTGRES_PASSWORD is set but Kuroshiro does not read it; it is ignored. Use KUROSHIRO_DB_PASSWORD instead',
      'KUROSHIRO_POSTGRES_DB is set but Kuroshiro does not read it; it is ignored. Use KUROSHIRO_DB_DB instead',
      'KUROSHIRO_POSTGRES_PORT is set but Kuroshiro does not read it; it is ignored. Use KUROSHIRO_DB_PORT instead',
      'KUROSHIRO_API_PORT is set but Kuroshiro does not read it; it is ignored. Use KUROSHIRO_PORT instead',
    ])
  })
})
