import type { InstanceFacts, InstanceLimits } from 'kuroshiro-shared'

export interface InstanceFactsSource {
  version: string
  serverUrl: string
  timezone: string
  demoMode: boolean
  appriseUrl: string | undefined
  limits: InstanceLimits
}

const LOOPBACK_IPV4 = /^127(?:\.\d{1,3}){3}$/

function parseUrl(raw: string): URL | null {
  try {
    return new URL(raw)
  }
  catch {
    return null
  }
}

function isLoopbackHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '[::1]' || LOOPBACK_IPV4.test(hostname)
}

export function isLoopbackUrl(raw: string): boolean {
  const url = parseUrl(raw)
  return url !== null && isLoopbackHost(url.hostname)
}

/** The address without its user and password; `null` when it cannot be parsed, so a malformed address never leaks its credentials. */
export function withoutCredentials(raw: string): string | null {
  const url = parseUrl(raw)
  if (!url || !/^https?:$/.test(url.protocol))
    return null
  const path = url.pathname === '/' ? '' : url.pathname
  return `${url.protocol}//${url.host}${path}${url.search}`
}

export function toInstanceFacts(source: InstanceFactsSource): InstanceFacts {
  return {
    version: source.version,
    serverUrl: source.serverUrl,
    serverUrlIsLoopback: isLoopbackUrl(source.serverUrl),
    timezone: source.timezone,
    demoMode: source.demoMode,
    notifications: {
      configured: !!source.appriseUrl,
      appriseUrl: source.appriseUrl ? withoutCredentials(source.appriseUrl) : null,
    },
    limits: source.limits,
  }
}
