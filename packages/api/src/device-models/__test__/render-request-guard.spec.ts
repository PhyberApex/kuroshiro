import type { HTTPRequest } from 'puppeteer'
import type { RenderRequestPolicy, Resolver } from '../render-request-guard.js'
import { describe, expect, it, vi } from 'vitest'
import { asService } from '../../test/mockService.js'
import { renderRequestRefusal, settleRenderRequest } from '../render-request-guard.js'

const SELF_HOSTED: RenderRequestPolicy = { demoMode: false, apiPort: 3000, apiUrl: 'https://kuroshiro.example.com', allowedPrivateHosts: [] }
const DEMO: RenderRequestPolicy = { ...SELF_HOSTED, demoMode: true }

/** An Instance whose admin named one LAN host, one range, one literal and the Docker network the API itself sits on. */
const ALLOWING: RenderRequestPolicy = { ...SELF_HOSTED, allowedPrivateHosts: ['homeassistant', '10.0.0.0/24', 'fd00::1', '172.18.0.0/16'] }

/** Answers each host name from a fixed table, an IP literal as itself, and fails any other name as DNS does. */
function resolverFor(table: Record<string, string[]>): Resolver {
  return async (hostname) => {
    if (/^[\d.]+$/.test(hostname) || hostname.includes(':'))
      return [{ address: hostname, family: hostname.includes(':') ? 6 : 4 }]
    const addresses = table[hostname]
    if (!addresses)
      throw new Error(`getaddrinfo ENOTFOUND ${hostname}`)
    return addresses.map(address => ({ address, family: address.includes(':') ? 6 : 4 }))
  }
}

const DNS = resolverFor({
  'trmnl.com': ['104.21.0.1'],
  'api.example.org': ['93.184.216.34'],
  'lvh.me': ['127.0.0.1'],
  'kuroshiro': ['172.18.0.5'],
  'homeassistant': ['192.168.1.20'],
  'nas': ['10.0.0.9'],
  'rebinding.example.org': ['93.184.216.34', '10.0.0.1'],
})
const OWN_ADDRESSES = () => new Set(['127.0.0.1', '::1', '172.18.0.5'])

async function refusal(url: string, policy: RenderRequestPolicy): Promise<string | null> {
  return renderRequestRefusal(url, policy, DNS, OWN_ADDRESSES)
}

describe('renderRequestRefusal', () => {
  describe.each([['self-hosted', SELF_HOSTED], ['demo mode', DEMO]] as const)('in %s', (_mode, policy) => {
    it.each([
      'http://localhost:3000/api/devices',
      'http://LOCALHOST./api/config/export',
      'http://api.localhost:3000/',
      'http://127.0.0.1:3000/api/devices',
      'http://127.8.8.8:5432/',
      'http://0.0.0.0:3000/',
      'http://[::1]:3000/',
      'http://[::ffff:127.0.0.1]:3000/',
      'http://lvh.me:3000/api/devices',
    ])('refuses the loopback address %s', async (url) => {
      expect(await refusal(url, policy)).not.toBeNull()
    })

    it('refuses the API on one of the host\'s own addresses', async () => {
      expect(await refusal('http://kuroshiro:3000/api/devices', policy)).not.toBeNull()
      expect(await refusal('http://172.18.0.5:3000/api/devices', policy)).not.toBeNull()
    })

    it('refuses the API at the address devices are told to reach it at', async () => {
      expect(await refusal('https://kuroshiro.example.com/api/config/export', policy)).not.toBeNull()
    })

    it.each(['file:///etc/passwd', 'ftp://trmnl.com/', 'chrome://version'])('refuses the non-web address %s', async (url) => {
      expect(await refusal(url, policy)).not.toBeNull()
    })

    it.each([
      'https://trmnl.com/css/3.4.6/plugins.css',
      'https://trmnl.com/fonts/Inter.ttf',
      'https://api.example.org/forecast?city=Berlin',
      'data:image/png;base64,iVBORw0KGgo=',
      'blob:null/5b8e0f0c-0000-0000-0000-000000000000',
      'about:blank',
    ])('lets %s through', async (url) => {
      expect(await refusal(url, policy)).toBeNull()
    })
  })

  describe('self-hosted with nothing allowed', () => {
    it.each([
      'http://homeassistant:8123/api/states',
      'http://10.0.0.7/',
      'http://192.168.1.1/',
      'http://169.254.169.254/latest/meta-data/',
      'http://[fd00::1]/',
      'http://printer.local/',
      'http://metadata.google.internal/computeMetadata/v1/',
    ])('refuses the internal address %s', async (url) => {
      expect(await refusal(url, SELF_HOSTED)).not.toBeNull()
    })

    it('refuses a name when any one of its addresses is private', async () => {
      expect(await refusal('http://rebinding.example.org/', SELF_HOSTED)).not.toBeNull()
    })

    it('refuses another port of the host\'s own private address, which the API shares its network with', async () => {
      expect(await refusal('http://kuroshiro:8123/', SELF_HOSTED)).not.toBeNull()
    })

    it('leaves a name that does not resolve to the browser, which fails it as well', async () => {
      expect(await refusal('https://no-such-host.example.org/', SELF_HOSTED)).toBeNull()
    })
  })

  describe('self-hosted with an allowlist', () => {
    it('lets an allowed name through at every address it resolves to, named or not', async () => {
      expect(await refusal('http://homeassistant:8123/api/states', ALLOWING)).toBeNull()
    })

    it('lets a host whose addresses fall in an allowed range through', async () => {
      expect(await refusal('http://nas:5000/', ALLOWING)).toBeNull()
      expect(await refusal('http://10.0.0.7/', ALLOWING)).toBeNull()
    })

    it('lets an allowed address literal through', async () => {
      expect(await refusal('http://[fd00::1]/', ALLOWING)).toBeNull()
    })

    it('lets another port of the host\'s own address through once its network is allowed', async () => {
      expect(await refusal('http://kuroshiro:8123/', ALLOWING)).toBeNull()
    })

    it.each([
      'http://10.0.1.5/',
      'http://192.168.1.1/',
      'http://[fd00::2]/',
      'http://printer.local/',
    ])('still refuses %s, which no entry names', async (url) => {
      expect(await refusal(url, ALLOWING)).not.toBeNull()
    })

    it.each([
      'http://localhost:3000/api/devices',
      'http://127.0.0.1:3000/api/devices',
      'http://kuroshiro:3000/api/devices',
      'https://kuroshiro.example.com/api/config/export',
    ])('refuses %s however the allowlist names it, as the API holds the secrets', async (url) => {
      const naming: RenderRequestPolicy = { ...SELF_HOSTED, allowedPrivateHosts: ['localhost', '127.0.0.0/8', 'kuroshiro', '172.18.0.0/16', 'kuroshiro.example.com'] }

      expect(await refusal(url, naming)).not.toBeNull()
    })
  })

  describe('demo mode', () => {
    it.each([
      'http://169.254.169.254/latest/meta-data/',
      'http://metadata.google.internal/computeMetadata/v1/',
      'http://10.0.0.7/',
      'http://192.168.1.1/',
      'http://[fd00::1]/',
      'http://printer.local/',
    ])('refuses the internal address %s as written', async (url) => {
      expect(await refusal(url, DEMO)).not.toBeNull()
    })

    it('refuses a public name that resolves to a private address', async () => {
      expect(await refusal('http://homeassistant:8123/api/states', DEMO)).not.toBeNull()
      expect(await refusal('http://kuroshiro:8123/', DEMO)).not.toBeNull()
    })

    it('refuses a name when any one of its addresses is private', async () => {
      expect(await refusal('http://rebinding.example.org/', DEMO)).not.toBeNull()
    })

    it('refuses a name that does not resolve, since no address was checked', async () => {
      expect(await refusal('https://no-such-host.example.org/', DEMO)).not.toBeNull()
    })

    it('refuses what the allowlist names, which a public Instance has no business reaching', async () => {
      const allowing: RenderRequestPolicy = { ...ALLOWING, demoMode: true }

      expect(await refusal('http://homeassistant:8123/api/states', allowing)).not.toBeNull()
      expect(await refusal('http://10.0.0.7/', allowing)).not.toBeNull()
      expect(await refusal('http://[fd00::1]/', allowing)).not.toBeNull()
    })
  })
})

describe('settleRenderRequest', () => {
  function pageRequest(url: string) {
    return {
      url: () => url,
      method: () => 'GET',
      headers: () => ({ accept: 'text/css' }),
      postData: () => undefined,
      continue: vi.fn().mockResolvedValue(undefined),
      abort: vi.fn().mockResolvedValue(undefined),
      respond: vi.fn().mockResolvedValue(undefined),
    }
  }

  const css = () => new Response('.title { font-weight: bold }', { status: 200, headers: { 'content-type': 'text/css', 'content-encoding': 'gzip', 'content-length': '999' } })

  it('lets a self-hosted request through to Chromium', async () => {
    const request = pageRequest('http://10.0.0.7/')
    const requester = vi.fn()

    await settleRenderRequest(asService<HTTPRequest>(request), ALLOWING, requester)

    expect(request.continue).toHaveBeenCalledOnce()
    expect(requester).not.toHaveBeenCalled()
  })

  it('aborts a refused request without making it', async () => {
    const request = pageRequest('http://127.0.0.1:3000/api/devices')
    const requester = vi.fn()

    await settleRenderRequest(asService<HTTPRequest>(request), DEMO, requester)

    expect(request.abort).toHaveBeenCalledWith('blockedbyclient')
    expect(request.continue).not.toHaveBeenCalled()
    expect(requester).not.toHaveBeenCalled()
  })

  it('makes a demo-mode request through the guarded fetch and answers the page with its decoded response', async () => {
    const request = pageRequest('https://93.184.216.34/plugins.css')
    const requester = vi.fn().mockResolvedValue(css())

    await settleRenderRequest(asService<HTTPRequest>(request), DEMO, requester)

    expect(requester).toHaveBeenCalledWith('https://93.184.216.34/plugins.css', expect.objectContaining({ method: 'GET', headers: { accept: 'text/css' } }))
    expect(request.continue).not.toHaveBeenCalled()
    const answer = request.respond.mock.calls[0][0]
    expect(answer.status).toBe(200)
    expect(answer.headers).toEqual({ 'content-type': 'text/css' })
    expect(answer.body.toString()).toBe('.title { font-weight: bold }')
  })

  it('leaves a demo-mode data: address to the browser', async () => {
    const request = pageRequest('data:text/plain,hi')
    const requester = vi.fn()

    await settleRenderRequest(asService<HTTPRequest>(request), DEMO, requester)

    expect(request.continue).toHaveBeenCalledOnce()
    expect(requester).not.toHaveBeenCalled()
  })

  it('fails when the guarded fetch refuses the address it connected to', async () => {
    const request = pageRequest('https://93.184.216.34/')
    const requester = vi.fn().mockRejectedValue(new Error('Requests to private IP ranges are not allowed in demo mode'))

    await expect(settleRenderRequest(asService<HTTPRequest>(request), DEMO, requester)).rejects.toThrow('private IP')
    expect(request.continue).not.toHaveBeenCalled()
  })
})
