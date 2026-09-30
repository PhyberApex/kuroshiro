import process from 'node:process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import config from '../config.js'

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
        offlineMultiplier: 3,
        fetchFailureThreshold: 3,
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
        offlineMultiplier: 5,
        fetchFailureThreshold: 4,
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
      offlineMultiplier: 3,
      fetchFailureThreshold: 3,
    })
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('KUROSHIRO_ALERT_LOW_BATTERY_PERCENT'))
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('KUROSHIRO_ALERT_OFFLINE_MULTIPLIER'))
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('KUROSHIRO_ALERT_FETCH_FAILURES'))

    warnSpy.mockRestore()
  })
})
