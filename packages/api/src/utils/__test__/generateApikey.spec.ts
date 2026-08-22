import { describe, expect, it } from 'vitest'
import generateApiKey from '../generateApikey'
import randomUrlSafeToken from '../randomUrlSafeToken'

describe('generateApiKey', () => {
  it('returns a string of length 22', () => {
    const key = generateApiKey()
    expect(typeof key).toBe('string')
    expect(key.length).toBe(22)
  })

  it('returns a URL-safe string', () => {
    const key = generateApiKey()
    expect(key).not.toMatch(/[+/=]/)
  })

  it('returns unique values for multiple calls', () => {
    const keys = new Set(Array.from({ length: 100 }, () => generateApiKey()))
    expect(keys.size).toBe(100)
  })
})

describe('randomUrlSafeToken', () => {
  it('returns the requested URL-safe token length', () => {
    const token = randomUrlSafeToken(10)

    expect(token).toHaveLength(10)
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/)
  })
})
