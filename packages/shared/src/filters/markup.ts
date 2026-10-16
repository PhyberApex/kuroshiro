import { Marked } from 'marked'
import { encode } from 'uqr'

/** Redcarpet with no extensions, as the gem builds it: no tables, fenced code, autolinks or strikethrough. */
const markdown = new Marked({ gfm: false, async: false })

export function markdownToHtml(value: unknown): string {
  return (markdown.parse(String(value ?? '')) as string).trim()
}

const LEVELS: Record<string, 'L' | 'M' | 'Q' | 'H'> = { l: 'L', m: 'M', q: 'Q', h: 'H' }

/**
 * TRMNL's `qr_code(data, size = 11, level = '', view = 'responsive')`: the gem's markup, one `<svg class="qr-code">` of
 * `size` pixels a module, black on a white rect, with a `viewBox` that scales to the container unless the view is anything but responsive.
 */
export function qrCode(value: unknown, moduleSize: unknown = 11, level: unknown = '', view: unknown = 'responsive'): string {
  const ecc = LEVELS[String(level).toLowerCase()] ?? 'H'
  const { data, size: modules } = encode(String(value ?? ''), { ecc, border: 0, boostEcc: false })
  const pixels = Number(moduleSize) > 0 ? Number(moduleSize) : 11
  const side = modules * pixels
  const path = data.flatMap((row, y) => row.flatMap((dark, x) => (dark ? [`M${x * pixels} ${y * pixels}h${pixels}v${pixels}h-${pixels}z`] : []))).join('')
  const extent = view === 'responsive' ? `viewBox="0 0 ${side} ${side}"` : `width="${side}" height="${side}"`
  return `<svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:ev="http://www.w3.org/2001/xml-events" class="qr-code" shape-rendering="crispEdges" ${extent}>`
    + `<rect width="${side}" height="${side}" x="0" y="0" fill="#fff"/><path d="${path}" fill="#000"/></svg>`
}
