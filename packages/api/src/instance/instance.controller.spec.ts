import type { InstanceFacts } from 'kuroshiro-shared'
import type { HttpTestApp } from '../test/httpApp.js'
import process from 'node:process'
import { ConfigService } from '@nestjs/config'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import config from '../config/config.js'
import { createHttpTestApp } from '../test/httpApp.js'
import { UPLOAD_LIMITS } from '../uploads/upload-limits.js'
import { InstanceController } from './instance.controller.js'

const ENV_KEYS = ['KUROSHIRO_API_URL', 'KUROSHIRO_DEMO_MODE', 'KUROSHIRO_APPRISE_URL', 'KUROSHIRO_APPRISE_KEY', 'TZ']

describe('gET /api/instance', () => {
  const originalEnv = Object.fromEntries(ENV_KEYS.map(key => [key, process.env[key]]))
  let http: HttpTestApp

  async function readFacts(env: Record<string, string> = {}): Promise<{ facts: InstanceFacts, raw: string }> {
    Object.assign(process.env, env)
    const response = await http.request('/api/instance')
    expect(response.status).toBe(200)
    const raw = await response.text()
    return { facts: JSON.parse(raw), raw }
  }

  beforeAll(async () => {
    http = await createHttpTestApp({
      controllers: [InstanceController],
      providers: [{ provide: ConfigService, useValue: { get: (key: string) => config()[key as 'alerts'], getOrThrow: (key: string) => config()[key as 'alerts'] } }],
    })
  })

  afterEach(() => {
    ENV_KEYS.forEach((key) => {
      if (originalEnv[key] === undefined)
        delete process.env[key]
      else
        process.env[key] = originalEnv[key]
    })
  })

  afterAll(async () => {
    await http.app.close()
  })

  it('answers every key of the Instance facts', async () => {
    const { facts } = await readFacts({ KUROSHIRO_API_URL: 'http://192.168.1.20:3000', KUROSHIRO_DEMO_MODE: 'true' })
    expect(Object.keys(facts).sort()).toEqual(['demoMode', 'limits', 'notifications', 'serverUrl', 'serverUrlIsLoopback', 'timezone', 'version'])
    expect(facts).toMatchObject({
      serverUrl: 'http://192.168.1.20:3000',
      serverUrlIsLoopback: false,
      demoMode: true,
      notifications: { configured: false, appriseUrl: null },
      limits: UPLOAD_LIMITS,
    })
    expect(facts.version).toMatch(/^\d+\.\d+\.\d+/)
  })

  it('flags a loopback server URL', async () => {
    expect((await readFacts({ KUROSHIRO_API_URL: 'http://localhost:3000' })).facts.serverUrlIsLoopback).toBe(true)
  })

  it('follows KUROSHIRO_DEMO_MODE', async () => {
    delete process.env.KUROSHIRO_DEMO_MODE
    expect((await readFacts()).facts.demoMode).toBe(false)
  })

  it('holds neither the credentials of the Apprise URL nor the Apprise key', async () => {
    const { facts, raw } = await readFacts({ KUROSHIRO_APPRISE_URL: 'http://user:secret@apprise:8000', KUROSHIRO_APPRISE_KEY: 'topsecretkey' })
    expect(facts.notifications).toEqual({ configured: true, appriseUrl: 'http://apprise:8000' })
    expect(raw).not.toMatch(/user|secret|topsecretkey/)
  })

  it('names the zone the process runs in', async () => {
    const { facts } = await readFacts({ TZ: 'Asia/Tokyo' })
    expect(facts.timezone).toBe('Asia/Tokyo')
    expect(facts.timezone).toBe(new Intl.DateTimeFormat().resolvedOptions().timeZone)
  })

  it('names the zone the process resolves when TZ is unset', async () => {
    delete process.env.TZ
    const { facts } = await readFacts()
    expect(facts.timezone).toBe(new Intl.DateTimeFormat().resolvedOptions().timeZone)
    expect(facts.timezone).not.toBe('')
  })
})
