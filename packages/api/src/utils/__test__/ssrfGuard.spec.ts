import type { LookupAddress } from 'node:dns'
import type { AddressInfo } from 'node:net'
import { lookup } from 'node:dns/promises'
import { createServer } from 'node:http'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { realFetch, stubFetch } from '../../test/fetch.js'
import { assertPublicUrl, fetchPublic, resolvePublic } from '../ssrfGuard.js'

vi.mock('node:dns/promises', () => ({ lookup: vi.fn() }))

const mockLookup = vi.mocked(lookup as unknown as (host: string, options: { all: true }) => Promise<LookupAddress[]>)
const mockFetch = stubFetch()

/** Answers every host name with these addresses. */
function resolvesTo(...addresses: string[]) {
  mockLookup.mockResolvedValue(addresses.map(address => ({ address, family: address.includes(':') ? 6 : 4 })))
}

const redirectTo = (location: string, status = 302) => new Response(null, { status, headers: { location } })

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

  describe('ipv4 0.0.0.0/8 ("this" network)', () => {
    it('rejects the range, which reaches the host itself', () => {
      expect(() => assertPublicUrl('http://0.0.0.0:3000/')).toThrow(/private IP ranges/)
      expect(() => assertPublicUrl('http://0.255.255.255/')).toThrow(/private IP ranges/)
    })
  })

  describe('ipv4 100.64.0.0/10 (carrier-grade NAT)', () => {
    it('rejects the range', () => {
      expect(() => assertPublicUrl('http://100.64.0.1/')).toThrow(/private IP ranges/)
      expect(() => assertPublicUrl('http://100.127.255.255/')).toThrow(/private IP ranges/)
    })

    it('allows the neighbouring addresses', () => {
      expect(() => assertPublicUrl('http://100.63.255.255/')).not.toThrow()
      expect(() => assertPublicUrl('http://100.128.0.0/')).not.toThrow()
    })
  })

  it('reads an IPv4 address spelled as one number, as the URL does', () => {
    expect(() => assertPublicUrl('http://2130706433/')).toThrow(/private IP ranges/)
  })

  describe('ipv6', () => {
    it('rejects loopback and unique local addresses', () => {
      expect(() => assertPublicUrl('http://[::1]/data')).toThrow(/private IP ranges/)
      expect(() => assertPublicUrl('http://[fc00::1]/data')).toThrow(/private IP ranges/)
      expect(() => assertPublicUrl('http://[fd00::1]/data')).toThrow(/private IP ranges/)
    })

    it('rejects the unspecified and link-local addresses', () => {
      expect(() => assertPublicUrl('http://[::]/data')).toThrow(/private IP ranges/)
      expect(() => assertPublicUrl('http://[fe80::1]/')).toThrow(/private IP ranges/)
      expect(() => assertPublicUrl('http://[febf::1]/')).toThrow(/private IP ranges/)
    })

    it('rejects an IPv4-mapped address of a private IPv4 address', () => {
      expect(() => assertPublicUrl('http://[::ffff:127.0.0.1]:3000/api/')).toThrow(/private IP ranges/)
      expect(() => assertPublicUrl('http://[::ffff:169.254.169.254]/')).toThrow(/private IP ranges/)
    })

    it('allows an IPv4-mapped address of a public IPv4 address', () => {
      expect(() => assertPublicUrl('http://[::ffff:8.8.8.8]/')).not.toThrow()
    })

    it('allows a public IPv6 address', () => {
      expect(() => assertPublicUrl('http://[2001:4860:4860::8888]/data')).not.toThrow()
    })
  })
})

describe('resolvePublic', () => {
  beforeEach(() => {
    mockLookup.mockReset()
  })

  it('answers the addresses of a host name that resolves to public addresses only', async () => {
    resolvesTo('93.184.215.14', '2606:2800:21f:cb07:6820:80da:af6b:8b2c')

    expect(await resolvePublic('api.example.com')).toEqual([
      { address: '93.184.215.14', family: 4 },
      { address: '2606:2800:21f:cb07:6820:80da:af6b:8b2c', family: 6 },
    ])
    expect(mockLookup).toHaveBeenCalledWith('api.example.com', { all: true })
  })

  it('rejects a public host name that resolves to loopback', async () => {
    resolvesTo('127.0.0.1')

    await expect(resolvePublic('127.0.0.1.nip.io')).rejects.toThrow(/private IP ranges/)
  })

  it('rejects a host name when any one of its addresses is private', async () => {
    resolvesTo('93.184.215.14', '10.0.0.5')

    await expect(resolvePublic('split.example')).rejects.toThrow(/private IP ranges/)
  })

  it('rejects a host name that resolves to an IPv4-mapped private address', async () => {
    resolvesTo('::ffff:127.0.0.1')

    await expect(resolvePublic('mapped.example')).rejects.toThrow(/private IP ranges/)
  })
})

describe('fetchPublic', () => {
  beforeEach(() => {
    mockLookup.mockReset()
    mockFetch.mockReset()
    resolvesTo('93.184.215.14')
  })

  it('makes the request without following redirects itself and answers the response', async () => {
    const response = new Response('ok')
    mockFetch.mockResolvedValue(response)

    expect(await fetchPublic('https://api.example.com/data', { method: 'GET' })).toBe(response)
    expect(mockFetch).toHaveBeenCalledWith('https://api.example.com/data', expect.objectContaining({ method: 'GET', redirect: 'manual' }))
  })

  it('refuses an internal host name without looking it up', async () => {
    await expect(fetchPublic('http://localhost./data')).rejects.toThrow(/internal hosts/)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('refuses a redirect to a private address before requesting it', async () => {
    mockFetch.mockResolvedValueOnce(redirectTo('http://169.254.169.254/latest/meta-data/'))

    await expect(fetchPublic('https://attacker.example/r')).rejects.toThrow(/private IP ranges/)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('follows a redirect to a public address, relative to the address it came from', async () => {
    const final = new Response('done')
    mockFetch.mockResolvedValueOnce(redirectTo('/next?page=2', 301)).mockResolvedValueOnce(final)

    expect(await fetchPublic('https://api.example.com/start')).toBe(final)
    expect(mockFetch).toHaveBeenLastCalledWith('https://api.example.com/next?page=2', expect.objectContaining({ redirect: 'manual' }))
  })

  it('turns a POST into a GET without its body on a 303, as fetch does', async () => {
    mockFetch.mockResolvedValueOnce(redirectTo('https://api.example.com/result', 303)).mockResolvedValueOnce(new Response('done'))

    await fetchPublic('https://api.example.com/submit', { method: 'POST', body: '{}', headers: { 'content-type': 'application/json' } })

    const [, init] = mockFetch.mock.calls[1]!
    expect(init).toMatchObject({ method: 'GET', body: undefined })
    expect(new Headers(init!.headers).has('content-type')).toBe(false)
  })

  it('keeps the method and body on a 307', async () => {
    mockFetch.mockResolvedValueOnce(redirectTo('https://api.example.com/moved', 307)).mockResolvedValueOnce(new Response('done'))

    await fetchPublic('https://api.example.com/submit', { method: 'POST', body: '{}' })

    expect(mockFetch.mock.calls[1]![1]).toMatchObject({ method: 'POST', body: '{}' })
  })

  it('drops the Authorization header on a redirect to another origin, as fetch does', async () => {
    mockFetch.mockResolvedValueOnce(redirectTo('https://elsewhere.example/')).mockResolvedValueOnce(new Response('done'))

    await fetchPublic('https://api.example.com/', { headers: { Authorization: 'Bearer secret' } })

    expect(new Headers(mockFetch.mock.calls[1]![1]!.headers).has('authorization')).toBe(false)
  })

  it('gives up after too many redirects', async () => {
    mockFetch.mockImplementation(async () => redirectTo('https://api.example.com/loop'))

    await expect(fetchPublic('https://api.example.com/loop')).rejects.toThrow(/redirect/i)
  })

  it('answers the redirect itself when the caller asked for manual redirects', async () => {
    const redirect = redirectTo('http://127.0.0.1/')
    mockFetch.mockResolvedValueOnce(redirect)

    expect(await fetchPublic('https://api.example.com/', { redirect: 'manual' })).toBe(redirect)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('refuses a redirect when the caller asked for redirects to be an error', async () => {
    mockFetch.mockResolvedValueOnce(redirectTo('https://api.example.com/next'))

    await expect(fetchPublic('https://api.example.com/', { redirect: 'error' })).rejects.toThrow(/redirect/i)
  })
})

describe('fetchPublic connecting', () => {
  let received = 0
  let port = 0
  // An internal host: the server a refused request must never reach.
  const internal = createServer((_request, response) => {
    received++
    response.end('internal')
  })

  beforeAll(async () => {
    await new Promise<void>(resolve => internal.listen(0, '127.0.0.1', resolve))
    port = (internal.address() as AddressInfo).port
  })

  beforeEach(() => {
    received = 0
    mockLookup.mockReset()
    mockFetch.mockReset()
    mockFetch.mockImplementation(realFetch)
  })

  afterAll(async () => {
    await new Promise(resolve => internal.close(resolve))
  })

  it('refuses a host name that resolves to a private address when connecting', async () => {
    resolvesTo('127.0.0.1')

    await expect(fetchPublic(`http://inside.example:${port}/`)).rejects.toThrow(/private IP ranges/)
    expect(received).toBe(0)
    // The one resolution is the connection's own, made inside the request rather than ahead of it.
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(mockLookup).toHaveBeenCalledTimes(1)
    expect(mockLookup).toHaveBeenCalledWith('inside.example', { all: true })
  })

  it('connects to the address it checked, never resolving the host name a second time', async () => {
    // A rebinding name: a public address (TEST-NET-1, which nothing answers) first, the internal host afterwards.
    let resolvedWhileFetching = false
    mockLookup.mockImplementationOnce(async () => {
      resolvedWhileFetching = mockFetch.mock.calls.length > 0
      return [{ address: '192.0.2.1', family: 4 }]
    })
    mockLookup.mockResolvedValue([{ address: '127.0.0.1', family: 4 }])

    await expect(fetchPublic(`http://rebind.example:${port}/`, { signal: AbortSignal.timeout(300) })).rejects.toThrow()
    expect(received).toBe(0)
    // The one resolution is the connection's own, so the address it checked is the address connected to.
    expect(mockLookup).toHaveBeenCalledTimes(1)
    expect(resolvedWhileFetching).toBe(true)
  })

  it('refuses a redirect to a host name that resolves to a private address', async () => {
    mockFetch.mockReset()
    mockFetch.mockResolvedValueOnce(redirectTo(`http://inside.example:${port}/`)).mockImplementation(realFetch)
    resolvesTo('10.1.2.3')

    await expect(fetchPublic('https://attacker.example/r')).rejects.toThrow(/private IP ranges/)
    expect(received).toBe(0)
  })
})
