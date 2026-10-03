import type { InstanceFactsSource } from './instance-facts.js'
import { describe, expect, it } from 'vitest'
import { UPLOAD_LIMITS } from '../uploads/upload-limits.js'
import { isLoopbackUrl, toInstanceFacts, withoutCredentials } from './instance-facts.js'

const source: InstanceFactsSource = {
  version: '1.2.3',
  serverUrl: 'http://192.168.1.20:3000',
  timezone: 'Europe/Berlin',
  demoMode: false,
  appriseUrl: undefined,
  limits: UPLOAD_LIMITS,
}

describe('isLoopbackUrl', () => {
  it.each([
    'http://localhost:3000',
    'http://LOCALHOST',
    'http://127.0.0.1:3000',
    'http://127.12.0.9',
    'http://[::1]:3000',
  ])('is true for %s', (url) => {
    expect(isLoopbackUrl(url)).toBe(true)
  })

  it.each([
    'http://192.168.1.20:3000',
    'https://kuroshiro.example.com',
    'http://128.0.0.1',
    'http://127.0.0.1.example.com',
    'not a url',
  ])('is false for %s', (url) => {
    expect(isLoopbackUrl(url)).toBe(false)
  })
})

describe('withoutCredentials', () => {
  it('strips user and password', () => {
    expect(withoutCredentials('http://user:secret@apprise:8000')).toBe('http://apprise:8000')
  })

  it('strips a user without a password and keeps path and query', () => {
    expect(withoutCredentials('https://user@apprise.example.com/sub/path?x=1')).toBe('https://apprise.example.com/sub/path?x=1')
  })

  it('returns an address without credentials as it is', () => {
    expect(withoutCredentials('http://apprise:8000')).toBe('http://apprise:8000')
  })

  it('answers null for an address it cannot parse', () => {
    expect(withoutCredentials('user:secret@apprise')).toBeNull()
  })
})

describe('toInstanceFacts', () => {
  it('pins the serialized shape without Notifications', () => {
    expect(JSON.parse(JSON.stringify(toInstanceFacts(source)))).toEqual({
      version: '1.2.3',
      serverUrl: 'http://192.168.1.20:3000',
      serverUrlIsLoopback: false,
      timezone: 'Europe/Berlin',
      demoMode: false,
      notifications: { configured: false, appriseUrl: null },
      limits: UPLOAD_LIMITS,
    })
  })

  it('reports Notifications configured with the address stripped of credentials', () => {
    const facts = toInstanceFacts({ ...source, appriseUrl: 'http://user:secret@apprise:8000' })
    expect(facts.notifications).toEqual({ configured: true, appriseUrl: 'http://apprise:8000' })
    expect(JSON.stringify(facts)).not.toMatch(/user|secret/)
  })

  it('flags a loopback server address', () => {
    expect(toInstanceFacts({ ...source, serverUrl: 'http://localhost:3000' }).serverUrlIsLoopback).toBe(true)
  })
})
