import { Marked } from 'marked'
import qrcode from 'qrcode-generator'

const markdown = new Marked({ gfm: true, async: false })

export function markdownToHtml(value: unknown): string {
  return (markdown.parse(String(value)) as string).trim()
}

const LEVELS: Record<string, 'L' | 'M' | 'Q' | 'H'> = { l: 'L', m: 'M', q: 'Q', h: 'H' }

/** An inline `<svg class="qr-code">`; it scales to its container unless `"fixed"` pins it to `module_size` pixels a module. */
export function qrCode(value: unknown, moduleSize: unknown = 11, errorCorrection: unknown = 'm', mode?: unknown): string {
  const code = qrcode(0, LEVELS[String(errorCorrection).toLowerCase()] ?? 'M')
  code.addData(String(value))
  code.make()
  const count = code.getModuleCount()
  let path = ''
  for (let row = 0; row < count; row++) {
    for (let column = 0; column < count; column++) {
      if (code.isDark(row, column))
        path += `M${column} ${row}h1v1h-1z`
    }
  }
  const size = Number(moduleSize) > 0 ? Number(moduleSize) : 11
  const dimensions = mode === 'fixed' ? `width="${count * size}" height="${count * size}"` : 'width="100%" height="100%"'
  return `<svg class="qr-code" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${count} ${count}" ${dimensions} shape-rendering="crispEdges"><path d="${path}" fill="currentColor"/></svg>`
}
