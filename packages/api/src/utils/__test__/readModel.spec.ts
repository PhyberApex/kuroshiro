import { describe, expect, it } from 'vitest'
import { toImagePath, toIsoString, toIsoStringOrNull } from '../readModel.js'

describe('toIsoString', () => {
  it('serializes a Date as the ISO 8601 string JSON would produce', () => {
    const date = new Date('2026-10-03T08:15:30.123Z')

    expect(toIsoString(date)).toBe('2026-10-03T08:15:30.123Z')
    expect(JSON.stringify({ at: toIsoString(date) })).toBe(JSON.stringify({ at: date }))
  })
})

describe('toIsoStringOrNull', () => {
  it('serializes a Date', () => {
    expect(toIsoStringOrNull(new Date('2026-10-03T08:15:30.123Z'))).toBe('2026-10-03T08:15:30.123Z')
  })

  it('answers null for a null date', () => {
    expect(toIsoStringOrNull(null)).toBeNull()
  })

  it('answers null for an unloaded column, so the key is never missing', () => {
    expect(toIsoStringOrNull(undefined)).toBeNull()
  })
})

describe('toImagePath', () => {
  it('appends the version in milliseconds to a root-relative path', () => {
    const version = new Date('2026-10-03T08:15:30.123Z')

    expect(toImagePath('/screens/devices/d1/s1.png', version)).toBe(`/screens/devices/d1/s1.png?v=${version.getTime()}`)
  })

  it('roots a path given without its leading slash', () => {
    expect(toImagePath('screens/devices/d1/s1.png', new Date(1700000000000))).toBe('/screens/devices/d1/s1.png?v=1700000000000')
  })
})
