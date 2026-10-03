export function toIsoString(date: Date): string {
  return date.toISOString()
}

export function toIsoStringOrNull(date: Date | null | undefined): string | null {
  return date ? date.toISOString() : null
}

/**
 * An image address on an admin read: root-relative, so the UI can prefix its own base path
 * (a Home Assistant ingress prefix included), with the instant the image last changed as
 * its cache-busting version.
 */
export function toImagePath(path: string, version: Date): string {
  const rooted = path.startsWith('/') ? path : `/${path}`
  return `${rooted}?v=${version.getTime()}`
}
