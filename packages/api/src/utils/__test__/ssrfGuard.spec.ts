import { describe, expect, it } from 'vitest'
import { assertPublicUrl } from '../ssrfGuard.js'

describe('assertPublicUrl', () => {
  it('allows a public URL', () => {
    expect(() => assertPublicUrl('https://api.example.com/data')).not.toThrow()
  })

  it('rejects an invalid URL', () => {
    expect(() => assertPublicUrl('not a url')).toThrow('Invalid URL')
  })

  it('rejects localhost and internal hostnames', () => {
    expect(() => assertPublicUrl('http://localhost/data')).toThrow(/internal hosts/)
    expect(() => assertPublicUrl('http://metadata.google.internal/data')).toThrow(/internal hosts/)
    expect(() => assertPublicUrl('http://my-service.internal/data')).toThrow(/internal hosts/)
    expect(() => assertPublicUrl('http://box.local/data')).toThrow(/internal hosts/)
  })

  describe('ipv4 loopback (127.0.0.0/8)', () => {
    it('rejects the range', () => {
      expect(() => assertPublicUrl('http://127.0.0.1/data')).toThrow(/private IP ranges/)
      expect(() => assertPublicUrl('http://127.255.255.255/data')).toThrow(/private IP ranges/)
    })
  })

  describe('ipv4 10.0.0.0/8', () => {
    it('rejects the range, including its upper boundary', () => {
      expect(() => assertPublicUrl('http://10.0.0.0/data')).toThrow(/private IP ranges/)
      expect(() => assertPublicUrl('http://10.255.255.255/data')).toThrow(/private IP ranges/)
    })
  })

  describe('ipv4 172.16.0.0/12', () => {
    it('rejects the range', () => {
      expect(() => assertPublicUrl('http://172.16.0.0/data')).toThrow(/private IP ranges/)
      expect(() => assertPublicUrl('http://172.31.255.255/data')).toThrow(/private IP ranges/)
    })

    it('allows the address just past the upper boundary', () => {
      expect(() => assertPublicUrl('http://172.32.0.0/data')).not.toThrow()
    })

    it('allows the address just before the lower boundary', () => {
      expect(() => assertPublicUrl('http://172.15.255.255/data')).not.toThrow()
    })
  })

  describe('ipv4 192.168.0.0/16', () => {
    it('rejects the range', () => {
      expect(() => assertPublicUrl('http://192.168.0.0/data')).toThrow(/private IP ranges/)
      expect(() => assertPublicUrl('http://192.168.255.255/data')).toThrow(/private IP ranges/)
    })

    it('allows a neighboring /16 that is not the private range', () => {
      expect(() => assertPublicUrl('http://192.169.0.0/data')).not.toThrow()
    })
  })

  describe('ipv4 169.254.0.0/16 (link-local)', () => {
    it('rejects the range', () => {
      expect(() => assertPublicUrl('http://169.254.0.1/data')).toThrow(/private IP ranges/)
    })
  })

  describe('ipv6', () => {
    it('rejects loopback and unique local addresses', () => {
      expect(() => assertPublicUrl('http://[::1]/data')).toThrow(/private IP ranges/)
      expect(() => assertPublicUrl('http://[fc00::1]/data')).toThrow(/private IP ranges/)
      expect(() => assertPublicUrl('http://[fd00::1]/data')).toThrow(/private IP ranges/)
    })

    it('allows a public IPv6 address', () => {
      expect(() => assertPublicUrl('http://[2001:4860:4860::8888]/data')).not.toThrow()
    })
  })
})
