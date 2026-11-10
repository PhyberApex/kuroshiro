import type { RenderRequestPolicy, Resolver } from '../render-request-guard.js'
import { describe, expect, it } from 'vitest'
import { renderRequestRefusal } from '../render-request-guard.js'

const SELF_HOSTED: RenderRequestPolicy = { demoMode: false, apiPort: 3000, apiUrl: 'https://kuroshiro.example.com' }
const DEMO: RenderRequestPolicy = { ...SELF_HOSTED, demoMode: true }

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

  describe('self-hosted', () => {
    it('lets a private host on the network through, as a self-hosted Recipe may read the LAN', async () => {
      expect(await refusal('http://homeassistant:8123/api/states', SELF_HOSTED)).toBeNull()
      expect(await refusal('http://10.0.0.7/', SELF_HOSTED)).toBeNull()
    })

    it('lets another port of the host\'s own non-loopback address through', async () => {
      expect(await refusal('http://kuroshiro:8123/', SELF_HOSTED)).toBeNull()
    })

    it('leaves a name that does not resolve to the browser, which fails it as well', async () => {
      expect(await refusal('https://no-such-host.example.org/', SELF_HOSTED)).toBeNull()
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
  })
})
