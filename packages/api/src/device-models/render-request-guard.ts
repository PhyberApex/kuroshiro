import type { LookupAddress } from 'node:dns'
import type { HTTPRequest, Page } from 'puppeteer'
import type { Requester } from '../utils/ssrfGuard.js'
import buffer from 'node:buffer'
import { lookup } from 'node:dns/promises'
import net from 'node:net'
import os from 'node:os'
import { assertPublicUrl, fetchPublic, hostnameOf, isPrivateAddress, PRIVATE_IP_MESSAGE } from '../utils/ssrfGuard.js'

/**
 * What a render page may request. Template markup is third-party code (ADR-0072) and runs with JavaScript on, so
 * it must not reach the admin API, and in demo mode nothing internal at all (ADR-0052).
 */
export interface RenderRequestPolicy {
  demoMode: boolean
  /** The port the API listens on, refused on each of the host's own addresses. */
  apiPort: number
  /** The address devices are told to reach the Instance at, which may lead back to the API through a proxy. */
  apiUrl: string
}

/** How a host name is resolved: every address, as `dns.lookup` with `all` answers. */
export type Resolver = (hostname: string) => Promise<LookupAddress[]>

/** Schemes the browser answers itself, without a request leaving it. */
const BROWSER_LOCAL_PROTOCOLS = new Set(['data:', 'blob:', 'about:'])
const WEB_PROTOCOLS = new Set(['http:', 'https:'])
const DEFAULT_PORTS: Record<string, number> = { 'http:': 80, 'https:': 443 }

// The host itself: loopback and the "this host" network, which Linux connects to loopback, with IPv6's two. A
// BlockList matches an IPv4-mapped IPv6 address (::ffff:127.0.0.1) against the IPv4 subnets too.
const LOOPBACK = new net.BlockList()
LOOPBACK.addSubnet('127.0.0.0', 8, 'ipv4')
LOOPBACK.addSubnet('0.0.0.0', 8, 'ipv4')
LOOPBACK.addAddress('::1', 'ipv6')
LOOPBACK.addAddress('::', 'ipv6')

function isLoopback(ip: string): boolean {
  const family = net.isIP(ip)
  return family !== 0 && LOOPBACK.check(ip, family === 4 ? 'ipv4' : 'ipv6')
}

/** Chromium sends `localhost` and every `*.localhost` to loopback without asking DNS. */
function isLoopbackName(hostname: string): boolean {
  return hostname === 'localhost' || hostname.endsWith('.localhost')
}

const resolveAll: Resolver = hostname => lookup(hostname, { all: true })

/** The addresses of this host's own network interfaces. */
function ownInterfaceAddresses(): Set<string> {
  return new Set(Object.values(os.networkInterfaces()).flatMap(entries => (entries ?? []).map(entry => entry.address)))
}

function portOf(url: URL): number {
  return Number(url.port || DEFAULT_PORTS[url.protocol])
}

/** The `host:port` of a URL with the default port spelt out, so `https://a` and `https://a:443` compare equal. */
function hostAndPort(url: URL): string {
  return `${hostnameOf(url.href)}:${portOf(url)}`
}

function apiHostAndPort(apiUrl: string): string | null {
  try {
    return hostAndPort(new URL(apiUrl))
  }
  catch {
    return null
  }
}

const LOOPBACK_REFUSAL = 'loopback is the API\'s own host'
const API_REFUSAL = 'the API\'s own address'

/** The web address a request is for, `null` for one the browser answers itself, or why it is refused. */
function webUrlOf(url: string): URL | string | null {
  let parsed: URL
  try {
    parsed = new URL(url)
  }
  catch {
    return 'not a valid URL'
  }
  if (BROWSER_LOCAL_PROTOCOLS.has(parsed.protocol))
    return null
  return WEB_PROTOCOLS.has(parsed.protocol) ? parsed : `${parsed.protocol} is not a web address`
}

/** Why the host a web address names, as written, is refused, or `null`. */
function nameRefusal(url: URL, policy: RenderRequestPolicy): string | null {
  if (isLoopbackName(hostnameOf(url.href)))
    return LOOPBACK_REFUSAL
  if (hostAndPort(url) === apiHostAndPort(policy.apiUrl))
    return API_REFUSAL
  if (!policy.demoMode)
    return null
  try {
    assertPublicUrl(url.href)
    return null
  }
  catch (error) {
    return (error as Error).message
  }
}

/** Why connecting to `port` on the addresses a host resolved to is refused, or `null`. */
function addressRefusal(addresses: string[], port: number, policy: RenderRequestPolicy, own: Set<string>): string | null {
  if (addresses.some(isLoopback))
    return LOOPBACK_REFUSAL
  if (port === policy.apiPort && addresses.some(address => own.has(address)))
    return API_REFUSAL
  if (policy.demoMode && addresses.some(isPrivateAddress))
    return PRIVATE_IP_MESSAGE
  return null
}

/**
 * Why a render page may not make a request to `url`, or `null` when it may. Always refused: anything but the web and
 * the browser's own schemes, loopback, the API's port on the host's own addresses and the API's public address. In
 * demo mode, also every internal host, as written and as resolved, as the Data Source guard refuses it.
 *
 * Chromium resolves the name again to connect, so a name answering a public address here and a private one there
 * would get through: in demo mode {@link settleRenderRequest} makes the request itself instead.
 */
export async function renderRequestRefusal(url: string, policy: RenderRequestPolicy, resolve: Resolver = resolveAll, ownAddresses: () => Set<string> = ownInterfaceAddresses): Promise<string | null> {
  const web = webUrlOf(url)
  if (!(web instanceof URL))
    return web
  const refusedByName = nameRefusal(web, policy)
  if (refusedByName !== null)
    return refusedByName

  let addresses: string[]
  try {
    addresses = (await resolve(hostnameOf(web.href))).map(({ address }) => address)
  }
  catch {
    // The browser fails a name that does not resolve as well; in demo mode an address unchecked is refused.
    return policy.demoMode ? 'the host did not resolve' : null
  }
  return addressRefusal(addresses, portOf(web), policy, ownAddresses())
}

/** How long the guarded fetch waits for a demo-mode render's request. */
const DEMO_REQUEST_TIMEOUT_MS = 10_000

/** Headers that describe the body as sent, which fetch has already decoded. */
const DECODED_BODY_HEADERS = new Set(['content-encoding', 'content-length', 'transfer-encoding'])

/** Makes the page's request through `requester` and answers the page with what came back. */
async function respondThrough(request: HTTPRequest, requester: Requester): Promise<void> {
  const response = await requester(request.url(), {
    method: request.method(),
    headers: request.headers(),
    body: request.postData(),
    signal: AbortSignal.timeout(DEMO_REQUEST_TIMEOUT_MS),
  })
  const headers = Object.fromEntries([...response.headers].filter(([name]) => !DECODED_BODY_HEADERS.has(name)))
  await request.respond({ status: response.status, headers, body: buffer.Buffer.from(await response.arrayBuffer()) })
}

/**
 * Settles one request of a render page: aborted when {@link renderRequestRefusal} refuses it, else let through. In
 * demo mode a web request is made by `requester`, the guarded fetch, which checks the address it connects to and
 * every redirect, and the page is answered with its response, so Chromium never connects anywhere itself.
 */
export async function settleRenderRequest(request: HTTPRequest, policy: RenderRequestPolicy, requester: Requester = fetchPublic): Promise<void> {
  const url = request.url()
  if (await renderRequestRefusal(url, policy) !== null)
    await request.abort('blockedbyclient')
  else if (policy.demoMode && webUrlOf(url) instanceof URL)
    await respondThrough(request, requester)
  else
    await request.continue()
}

/**
 * Has `page` settle every request with {@link settleRenderRequest}, the document's own and its frames' alike: a
 * refused request fails as a network error would. Leaves the HTTP cache on, so renders keep sharing the framework
 * assets (ADR-0044); in demo mode, where the guarded fetch answers instead, they are fetched on every render.
 */
export async function guardRenderRequests(page: Page, policy: RenderRequestPolicy): Promise<void> {
  await page.setRequestInterception(true)
  page.on('request', (request) => {
    // Refused when it could not be settled; a request the page closed under has nothing left to settle.
    settleRenderRequest(request, policy).catch(() => request.abort('blockedbyclient').catch(() => {}))
  })
}
