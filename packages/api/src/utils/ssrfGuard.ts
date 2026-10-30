import type { LookupAddress } from 'node:dns'
import type { LookupFunction } from 'node:net'
import { lookup } from 'node:dns/promises'
import net from 'node:net'
import { Agent } from 'undici'

const PRIVATE_HOSTNAMES = new Set(['localhost', 'metadata.google.internal'])
const PRIVATE_HOSTNAME_SUFFIXES = ['.local', '.internal', '.localhost']

const PRIVATE_IP_MESSAGE = 'Requests to private IP ranges are not allowed in demo mode'

// Addresses that reach the host itself, its private networks or its cloud metadata: "this" network, loopback,
// RFC 1918, carrier-grade NAT and link-local (RFC 6890), and their IPv6 counterparts. A BlockList matches an
// IPv4-mapped IPv6 address (::ffff:a.b.c.d) against the IPv4 subnets too.
const PRIVATE_ADDRESSES = new net.BlockList()
for (const [network, prefix] of [['0.0.0.0', 8], ['127.0.0.0', 8], ['10.0.0.0', 8], ['172.16.0.0', 12], ['192.168.0.0', 16], ['169.254.0.0', 16], ['100.64.0.0', 10]] as const)
  PRIVATE_ADDRESSES.addSubnet(network, prefix, 'ipv4')
for (const [network, prefix] of [['::', 128], ['::1', 128], ['fc00::', 7], ['fe80::', 10]] as const)
  PRIVATE_ADDRESSES.addSubnet(network, prefix, 'ipv6')

function isPrivateAddress(ip: string): boolean {
  const family = net.isIP(ip)
  return family !== 0 && PRIVATE_ADDRESSES.check(ip, family === 4 ? 'ipv4' : 'ipv6')
}

/** The host a URL names, lower-cased, without IPv6 brackets or a trailing dot. */
function hostnameOf(url: string): string {
  let parsed: URL
  try {
    parsed = new URL(url)
  }
  catch {
    throw new Error('Invalid URL')
  }
  return parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '')
}

function assertPublicHostname(hostname: string): void {
  if (PRIVATE_HOSTNAMES.has(hostname) || PRIVATE_HOSTNAME_SUFFIXES.some(s => hostname.endsWith(s)))
    throw new Error(`Requests to internal hosts are not allowed in demo mode`)

  if (isPrivateAddress(hostname))
    throw new Error(PRIVATE_IP_MESSAGE)
}

/** Refuses a URL whose host, as written, is an internal name or a private address. Does not resolve a host name. */
export function assertPublicUrl(url: string): void {
  assertPublicHostname(hostnameOf(url))
}

/** A refusal made while connecting, told apart from the network failures fetch wraps alongside it. */
class PrivateDestinationError extends Error {}

/** The addresses a host name resolves to, refused when any one of them is private. */
export async function resolvePublic(hostname: string): Promise<LookupAddress[]> {
  const addresses = await lookup(hostname, { all: true })
  if (addresses.some(({ address }) => isPrivateAddress(address)))
    throw new PrivateDestinationError(PRIVATE_IP_MESSAGE)
  return addresses
}

/**
 * Resolves the host a socket is about to connect to and refuses it when private, so the address checked is the one
 * connected to: a name answering a public address to a check and a private one to the connect has no second answer
 * to give. The socket keeps the host name for the Host header and TLS SNI. Written as `net.connect` calls `lookup`.
 */
const publicLookup: LookupFunction = (hostname, options, callback) => {
  resolvePublic(hostname).then(
    addresses => options.all ? callback(null, addresses) : callback(null, addresses[0]!.address, addresses[0]!.family),
    (error: NodeJS.ErrnoException) => callback(error, []),
  )
}

/**
 * Connects only to addresses `publicLookup` checked. The global fetch dispatches through it, so undici stays on the
 * major the Node it runs on bundles (8 in Node 26): another major fails every request with "fetch failed", which the
 * connecting specs of fetchPublic catch.
 */
const publicAgent = new Agent({ connect: { lookup: publicLookup } })

/** How a request is made: `fetch`, or `fetchPublic` where the request has to stay off internal hosts. */
export type Requester = (url: string, init?: RequestInit) => Promise<Response>

/** As many redirects as fetch itself follows. */
const MAX_REDIRECTS = 20
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308])
const BODY_HEADERS = ['content-type', 'content-length', 'content-encoding', 'content-language', 'content-location']
const CREDENTIAL_HEADERS = ['authorization', 'cookie', 'proxy-authorization']

/** Whether fetch turns the request into a body-less GET on this redirect: a 303 does for any method but GET and HEAD, a 301 or 302 does for a POST. */
function becomesGet(status: number, method: string): boolean {
  if (status === 303)
    return !['GET', 'HEAD'].includes(method)
  return [301, 302].includes(status) && method === 'POST'
}

/** The request a redirect leads to, changed as fetch changes it: perhaps a body-less GET, and credentials stay on their origin. */
function redirectedInit(init: RequestInit, status: number, from: URL, to: URL): RequestInit {
  const headers = new Headers(init.headers)
  const toGet = becomesGet(status, (init.method ?? 'GET').toUpperCase())
  const dropped = [...(toGet ? BODY_HEADERS : []), ...(from.origin !== to.origin ? CREDENTIAL_HEADERS : [])]
  dropped.forEach(name => headers.delete(name))
  return toGet ? { ...init, headers, method: 'GET', body: undefined } : { ...init, headers }
}

/**
 * `fetch` refused for an internal destination, as demo mode needs: every host is checked as written, then resolved
 * and checked as the connection is made, and redirects are followed here rather than by fetch so each hop is checked
 * the same way.
 */
export async function fetchPublic(url: string, init: RequestInit = {}): Promise<Response> {
  let current = new URL(url)
  let currentInit = init
  for (let hop = 0; ; hop++) {
    assertPublicUrl(current.href)
    const response = await fetchThroughPublicAgent(current.href, { ...currentInit, redirect: 'manual' })
    const location = response.headers.get('location')
    if (init.redirect === 'manual' || !REDIRECT_STATUSES.has(response.status) || location === null)
      return response
    await response.body?.cancel()
    if (init.redirect === 'error')
      throw new TypeError('The host answered with a redirect, and redirects were refused.')
    if (hop === MAX_REDIRECTS)
      throw new TypeError(`The host redirected more than ${MAX_REDIRECTS} times.`)
    const next = new URL(location, current)
    currentInit = redirectedInit(currentInit, response.status, current, next)
    current = next
  }
}

/** `fetch` through `publicAgent`, rejecting with the refusal itself rather than fetch's "fetch failed" around it. */
async function fetchThroughPublicAgent(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, { ...init, dispatcher: publicAgent } as RequestInit)
  }
  catch (error) {
    if (error instanceof TypeError && error.cause instanceof PrivateDestinationError)
      throw error.cause
    throw error
  }
}

/** The requester for an instance: guarded in demo mode, plain `fetch` otherwise. */
export function requesterFor(demoMode: boolean | undefined): Requester {
  return demoMode ? fetchPublic : fetch
}
