import { afterEach, describe, expect, it } from 'vitest'
import { getBasePath, withBasePath } from '../basePath'

function setBaseHref(href: string) {
  const base = document.createElement('base')
  base.href = href
  document.head.appendChild(base)
}

describe('basePath', () => {
  afterEach(() => {
    document.head.querySelector('base')?.remove()
  })

  it('resolves an empty base path when served at the root', () => {
    expect(getBasePath()).toBe('')
    expect(withBasePath('/api/devices')).toBe('/api/devices')
  })

  it('resolves the prefix from an injected base element', () => {
    setBaseHref('/api/hassio_ingress/some-token/')
    expect(getBasePath()).toBe('/api/hassio_ingress/some-token')
    expect(withBasePath('/api/devices')).toBe('/api/hassio_ingress/some-token/api/devices')
  })

  it('normalizes a base href without a trailing slash', () => {
    setBaseHref('/foo/bar')
    expect(getBasePath()).toBe('/foo/bar')
  })

  it('leaves paths that are not absolute-path references unchanged', () => {
    setBaseHref('/foo/bar/')
    expect(withBasePath('https://example.com/image.png')).toBe('https://example.com/image.png')
  })
})
