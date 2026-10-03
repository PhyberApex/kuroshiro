import { describe, expect, it } from 'vitest'
import { basePathOf } from '..'

describe('basePathOf', () => {
  it('is the root when the UI is served at the root', () => {
    expect(basePathOf('http://kuroshiro.lan:3000/')).toBe('/')
  })

  it('is the prefix an ingress proxy serves the UI under', () => {
    expect(basePathOf('http://homeassistant.local:8123/api/hassio_ingress/kuroshiro/')).toBe('/api/hassio_ingress/kuroshiro/')
  })
})
