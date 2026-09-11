import process from 'node:process'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
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
})
