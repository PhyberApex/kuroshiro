import { describe, expect, it } from 'vitest'
import { cacheBustedUrl } from '../cacheBustedUrl'

describe('cacheBustedUrl', () => {
  it('appends the version as a query param', () => {
    expect(cacheBustedUrl('http://example.com/image.png', '2024-01-01T00:00:00Z')).toBe(
      `http://example.com/image.png?v=${encodeURIComponent('2024-01-01T00:00:00Z')}`,
    )
  })

  it('returns the plain url when the version is missing', () => {
    expect(cacheBustedUrl('http://example.com/image.png', undefined)).toBe('http://example.com/image.png')
    expect(cacheBustedUrl('http://example.com/image.png', null)).toBe('http://example.com/image.png')
  })
})
