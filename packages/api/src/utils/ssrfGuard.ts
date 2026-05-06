import net from 'node:net'

const PRIVATE_HOSTNAMES = new Set(['localhost', 'metadata.google.internal'])
const PRIVATE_HOSTNAME_SUFFIXES = ['.local', '.internal', '.localhost']

function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split('.').map(Number)
  if (parts.length !== 4 || parts.some(Number.isNaN))
    return false
  const [a, b] = parts
  return (
    a === 127
    || a === 10
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168)
    || (a === 169 && b === 254)
  )
}

function isPrivateIpv6(ip: string): boolean {
  const normalized = ip.toLowerCase()
  return normalized === '::1' || normalized.startsWith('fc') || normalized.startsWith('fd')
}

export function assertPublicUrl(url: string): void {
  let parsed: URL
  try {
    parsed = new URL(url)
  }
  catch {
    throw new Error('Invalid URL')
  }

  // Strip IPv6 brackets e.g. [::1]
  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '')

  if (PRIVATE_HOSTNAMES.has(hostname) || PRIVATE_HOSTNAME_SUFFIXES.some(s => hostname.endsWith(s)))
    throw new Error(`Requests to internal hosts are not allowed in demo mode`)

  if (net.isIPv4(hostname) && isPrivateIpv4(hostname))
    throw new Error(`Requests to private IP ranges are not allowed in demo mode`)

  if (net.isIPv6(hostname) && isPrivateIpv6(hostname))
    throw new Error(`Requests to private IP ranges are not allowed in demo mode`)
}
