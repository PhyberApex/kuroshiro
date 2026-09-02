import type { NextFunction, Request, RequestHandler, Response } from 'express'
import { promises as fs } from 'node:fs'
import path from 'node:path'

/**
 * A request is treated as the app shell (and gets index.html) unless it targets
 * our own API or names a file by extension (assets, favicons, screen images, ...),
 * which are left to the static file server / API controllers that follow this
 * middleware in the stack.
 */
function isAppShellRoute(requestPath: string): boolean {
  if (requestPath.startsWith('/api/'))
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
 * Injects a `<base href>` into index.html derived from the `X-Ingress-Path` header
 * Home Assistant's ingress proxy sends, so `document.baseURI` (and everything the UI
 * resolves from it) reflects the prefix the UI is actually being served under.
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
        res.type('html').send(html.replace(/<head(\s[^>]*)?>/i, match => `${match}\n    <base href="${base}">`))
      })
      .catch((err) => {
        indexHtml = null
        next(err)
      })
  }
}
