import buffer from 'node:buffer'
import generateApiKey from 'src/utils/generateApikey'
import { describe, expect, it } from 'vitest'

// Polyfill btoa for Node.js
globalThis.btoa = globalThis.btoa || function (str: string) {
  return buffer.Buffer.from(str, 'binary').toString('base64')
}

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
