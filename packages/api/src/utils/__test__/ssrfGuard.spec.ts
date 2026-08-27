import { describe, expect, it } from 'vitest'
import { assertPublicUrl } from '../ssrfGuard'

describe('assertPublicUrl', () => {
  it('allows a public URL', () => {
    expect(() => assertPublicUrl('https://example.com/data')).not.toThrow()
  })

  it('allows a public IPv4 address', () => {
    expect(() => assertPublicUrl('http://8.8.8.8/')).not.toThrow()
  })

  describe('private IPv4 ranges', () => {
    it('blocks the loopback range (127.0.0.0/8)', () => {
      expect(() => assertPublicUrl('http://127.0.0.1/')).toThrow('private IP ranges')
      expect(() => assertPublicUrl('http://127.255.255.255/')).toThrow('private IP ranges')
    })

    it('blocks the 10.0.0.0/8 range, including its upper boundary', () => {
      expect(() => assertPublicUrl('http://10.0.0.0/')).toThrow('private IP ranges')
      expect(() => assertPublicUrl('http://10.255.255.255/')).toThrow('private IP ranges')
    })

    it('blocks the 172.16.0.0/12 range but not addresses just outside it', () => {
      expect(() => assertPublicUrl('http://172.16.0.0/')).toThrow('private IP ranges')
      expect(() => assertPublicUrl('http://172.31.255.255/')).toThrow('private IP ranges')
      expect(() => assertPublicUrl('http://172.15.255.255/')).not.toThrow()
      expect(() => assertPublicUrl('http://172.32.0.0/')).not.toThrow()
    })

    it('blocks the 192.168.0.0/16 range but not addresses just outside it', () => {
      expect(() => assertPublicUrl('http://192.168.0.0/')).toThrow('private IP ranges')
      expect(() => assertPublicUrl('http://192.168.255.255/')).toThrow('private IP ranges')
      expect(() => assertPublicUrl('http://192.167.255.255/')).not.toThrow()
      expect(() => assertPublicUrl('http://192.169.0.0/')).not.toThrow()
    })

    it('blocks the link-local range (169.254.0.0/16), including the cloud metadata address', () => {
      expect(() => assertPublicUrl('http://169.254.169.254/')).toThrow('private IP ranges')
    })
  })

  it('blocks IPv6 loopback and unique local addresses', () => {
    expect(() => assertPublicUrl('http://[::1]/')).toThrow('private IP ranges')
    expect(() => assertPublicUrl('http://[fc00::1]/')).toThrow('private IP ranges')
    expect(() => assertPublicUrl('http://[fd12:3456::1]/')).toThrow('private IP ranges')
  })

  it('blocks known-internal hostnames and suffixes', () => {
    expect(() => assertPublicUrl('http://localhost/')).toThrow('internal hosts')
    expect(() => assertPublicUrl('http://metadata.google.internal/')).toThrow('internal hosts')
    expect(() => assertPublicUrl('http://foo.local/')).toThrow('internal hosts')
    expect(() => assertPublicUrl('http://foo.internal/')).toThrow('internal hosts')
    expect(() => assertPublicUrl('http://foo.localhost/')).toThrow('internal hosts')
  })

  it('rejects an invalid URL', () => {
    expect(() => assertPublicUrl('not-a-url')).toThrow('Invalid URL')
  })
})
