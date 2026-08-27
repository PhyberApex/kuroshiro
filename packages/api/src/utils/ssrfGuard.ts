import net from 'node:net'

const PRIVATE_HOSTNAMES = new Set(['localhost', 'metadata.google.internal'])
const PRIVATE_HOSTNAME_SUFFIXES = ['.local', '.internal', '.localhost']

function ipv4ToInt(ip: string): number {
  return ip.split('.').reduce((acc, part) => acc * 256 + Number(part), 0)
}

const PRIVATE_IPV4_RANGES: Array<[start: number, end: number]> = [
  ['127.0.0.0', '127.255.255.255'],
  ['10.0.0.0', '10.255.255.255'],
  ['172.16.0.0', '172.31.255.255'],
  ['192.168.0.0', '192.168.255.255'],
  ['169.254.0.0', '169.254.255.255'],
].map(([start, end]) => [ipv4ToInt(start), ipv4ToInt(end)])

function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split('.').map(Number)
  if (parts.length !== 4 || parts.some(Number.isNaN))
    return false
  const value = ipv4ToInt(ip)
  return PRIVATE_IPV4_RANGES.some(([start, end]) => value >= start && value <= end)
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
