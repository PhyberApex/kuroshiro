import { afterEach, describe, expect, it } from 'vitest'
import config from '../config'

const CONFIG_ENV_VARS = [
  'KUROSHIRO_PORT',
  'KUROSHIRO_API_URL',
  'KUROSHIRO_DEMO_MODE',
  'KUROSHIRO_DB_HOST',
  'KUROSHIRO_DB_PORT',
  'KUROSHIRO_DB_DB',
  'KUROSHIRO_DB_USER',
  'KUROSHIRO_DB_PASSWORD',
] as const

describe('config', () => {
  const originalEnv = Object.fromEntries(CONFIG_ENV_VARS.map(key => [key, process.env[key]]))

  afterEach(() => {
    for (const key of CONFIG_ENV_VARS) {
      if (originalEnv[key] === undefined)
        delete process.env[key]
      else
        process.env[key] = originalEnv[key]
    }
  })

  it('falls back to defaults when no env vars are set', () => {
    for (const key of CONFIG_ENV_VARS)
      delete process.env[key]

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
    })
  })

  it('reads every value from its env var override', () => {
    process.env.KUROSHIRO_PORT = '8080'
    process.env.KUROSHIRO_API_URL = 'https://example.com'
    process.env.KUROSHIRO_DEMO_MODE = 'true'
    process.env.KUROSHIRO_DB_HOST = 'db.example.com'
    process.env.KUROSHIRO_DB_PORT = '6543'
    process.env.KUROSHIRO_DB_DB = 'kuroshiro'
    process.env.KUROSHIRO_DB_USER = 'admin'
    process.env.KUROSHIRO_DB_PASSWORD = 'hunter2'

    expect(config()).toEqual({
      port: 8080,
      api_url: 'https://example.com',
      demo_mode: true,
      database: {
        host: 'db.example.com',
        port: 6543,
        database: 'kuroshiro',
        user: 'admin',
        password: 'hunter2',
      },
    })
  })

  it('falls back to port 3000 when KUROSHIRO_PORT is non-numeric', () => {
    process.env.KUROSHIRO_PORT = 'not-a-number'
    expect(config().port).toBe(3000)
  })

  it('treats any value other than the literal string "true" as demo_mode disabled', () => {
    process.env.KUROSHIRO_DEMO_MODE = 'false'
    expect(config().demo_mode).toBe(false)
    process.env.KUROSHIRO_DEMO_MODE = 'yes'
    expect(config().demo_mode).toBe(false)
  })
})
