import type { NextFunction, Request, RequestHandler, Response } from 'express'
import { promises as fs } from 'node:fs'
import path from 'node:path'

/**
 * A request is treated as the app shell (and gets index.html) unless it targets
 * our own API, the Prometheus scrape route or the health probe (both outside the
 * /api prefix) or names a file by extension (assets, favicons, screen images, ...), which are
 * left to the static file server / API controllers that follow this middleware
 * in the stack.
 */
function isAppShellRoute(requestPath: string): boolean {
  if (requestPath.startsWith('/api/') || requestPath === '/metrics' || requestPath === '/health')
    return false
  const lastSegment = requestPath.slice(requestPath.lastIndexOf('/') + 1)
  return requestPath === '/index.html' || !lastSegment.includes('.')
}

// A single leading slash keeps the value root-relative. A second leading slash or a
// backslash lets it parse as a scheme-relative URL (`//evil.com`, `/\evil.com`),
// hijacking every relative asset and `apiFetch` request the base href resolves.
function isRootRelativePath(value: string): boolean {
  return value.startsWith('/') && !value.startsWith('//') && !value.includes('\\')
}

function normalizeBaseHref(ingressPath: string | undefined): string {
  if (!ingressPath || !isRootRelativePath(ingressPath))
    return '/'
  return `${ingressPath.replace(/\/+$/, '')}/`
}

function escapeHtmlAttribute(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * Headers the app shell goes out with, so another site cannot frame the admin UI and
 * clickjack its buttons. `'self'` covers Home Assistant's ingress too: the proxy serves the
 * UI from HA's own origin, the same origin as the HA page that frames it. The policy is
 * `frame-ancestors` alone because the Plugin preview's `srcdoc` iframe inherits the
 * shell's CSP, and a plugin's markup loads scripts and styles from anywhere.
 */
const APP_SHELL_HEADERS = {
  'Content-Security-Policy': 'frame-ancestors \'self\'',
  'X-Frame-Options': 'SAMEORIGIN',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin',
}

const UI_ASSET_EXTENSIONS = new Set(['.js', '.css'])

/**
 * The static server's `setHeaders` hook: the UI's scripts and styles go out with `nosniff`,
 * so a browser never runs one as another type. An HTML file gets {@link APP_SHELL_HEADERS},
 * because ServeStatic's fallback sends index.html for any dotted path with no file behind it
 * (`/x.y`), past the middleware below, and that page must not be frameable either.
 * Screen images, which Devices fetch, are left alone.
 */
export function setUiAssetHeaders(res: Response, filePath: string): void {
  const extension = path.extname(filePath)
  if (extension === '.html')
    res.set(APP_SHELL_HEADERS)
  else if (UI_ASSET_EXTENSIONS.has(extension))
    res.setHeader('X-Content-Type-Options', 'nosniff')
}

/**
 * Injects a `<base href>` into index.html derived from the `X-Ingress-Path` header
 * Home Assistant's ingress proxy sends, so `document.baseURI` (and everything the UI
 * resolves from it) reflects the prefix the UI is actually being served under, and sends
 * it with {@link APP_SHELL_HEADERS}.
 */
export function ingressBasePathMiddleware(publicDir: string): RequestHandler {
  const indexPath = path.join(publicDir, 'index.html')
  let indexHtml: Promise<string> | null = null

  return (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET' || !isAppShellRoute(req.path)) {
      next()
      return
    }

    if (!indexHtml)
      indexHtml = fs.readFile(indexPath, 'utf-8')

    indexHtml
      .then((html) => {
        const base = escapeHtmlAttribute(normalizeBaseHref(req.header('X-Ingress-Path')))
        res.set(APP_SHELL_HEADERS).type('html').send(html.replace(/<head(\s[^>]*)?>/i, match => `${match}\n    <base href="${base}">`))
      })
      .catch((err) => {
        indexHtml = null
        next(err)
      })
  }
}
