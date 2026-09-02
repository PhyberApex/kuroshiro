import type { Request, Response } from 'express'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ingressBasePathMiddleware } from '../ingress-base-path.middleware.js'

function makeRequest(overrides: { method?: string, path: string, header?: (name: string) => string | undefined }): Request {
  return {
    method: 'GET',
    header: () => undefined,
    ...overrides,
  } as unknown as Request
}

function makeResponse() {
  const res = {
    type: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  }
  return res as unknown as Response & { type: ReturnType<typeof vi.fn>, send: ReturnType<typeof vi.fn> }
}

describe('ingressBasePathMiddleware', () => {
  let publicDir: string

  beforeEach(() => {
    publicDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kuroshiro-ingress-'))
    fs.writeFileSync(path.join(publicDir, 'index.html'), '<!DOCTYPE html>\n<html>\n  <head>\n    <title>Kuroshiro</title>\n  </head>\n  <body></body>\n</html>\n')
  })

  afterEach(() => {
    fs.rmSync(publicDir, { recursive: true, force: true })
  })

  it('injects a root base href when no ingress header is present', async () => {
    const middleware = ingressBasePathMiddleware(publicDir)
    const req = makeRequest({ path: '/' })
    const res = makeResponse()
    const next = vi.fn()

    middleware(req, res, next)
    await vi.waitFor(() => expect(res.send).toHaveBeenCalled())

    expect(next).not.toHaveBeenCalled()
    expect(res.type).toHaveBeenCalledWith('html')
    expect(res.send).toHaveBeenCalledWith(expect.stringContaining('<base href="/">'))
  })

  it('injects the ingress prefix from the X-Ingress-Path header, normalized with a trailing slash', async () => {
    const middleware = ingressBasePathMiddleware(publicDir)
    const req = makeRequest({ path: '/', header: (name: string) => (name === 'X-Ingress-Path' ? '/api/hassio_ingress/some-token' : undefined) })
    const res = makeResponse()
    const next = vi.fn()

    middleware(req, res, next)
    await vi.waitFor(() => expect(res.send).toHaveBeenCalled())

    expect(res.send).toHaveBeenCalledWith(expect.stringContaining('<base href="/api/hassio_ingress/some-token/">'))
  })

  it('escapes an attacker-controlled header value before embedding it', async () => {
    const middleware = ingressBasePathMiddleware(publicDir)
    const req = makeRequest({ path: '/', header: () => '/foo"><script>alert(1)</script>' })
    const res = makeResponse()
    const next = vi.fn()

    middleware(req, res, next)
    await vi.waitFor(() => expect(res.send).toHaveBeenCalled())

    const [html] = res.send.mock.calls[0] as [string]
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('&quot;&gt;&lt;script&gt;')
  })

  it('serves the app shell for a client-side route without a file extension', async () => {
    const middleware = ingressBasePathMiddleware(publicDir)
    const req = makeRequest({ path: '/devices/abc-123' })
    const res = makeResponse()
    const next = vi.fn()

    middleware(req, res, next)
    await vi.waitFor(() => expect(res.send).toHaveBeenCalled())

    expect(next).not.toHaveBeenCalled()
  })

  it('passes API requests through untouched', () => {
    const middleware = ingressBasePathMiddleware(publicDir)
    const req = makeRequest({ path: '/api/devices' })
    const res = makeResponse()
    const next = vi.fn()

    middleware(req, res, next)

    expect(next).toHaveBeenCalledOnce()
    expect(res.send).not.toHaveBeenCalled()
  })

  it('passes requests for files with an extension through to the static server', () => {
    const middleware = ingressBasePathMiddleware(publicDir)
    const req = makeRequest({ path: '/assets/index-abc123.js' })
    const res = makeResponse()
    const next = vi.fn()

    middleware(req, res, next)

    expect(next).toHaveBeenCalledOnce()
    expect(res.send).not.toHaveBeenCalled()
  })

  it('falls back to a root base href for a scheme-relative ingress path', async () => {
    const middleware = ingressBasePathMiddleware(publicDir)
    const req = makeRequest({ path: '/', header: () => '//evil.example' })
    const res = makeResponse()
    const next = vi.fn()

    middleware(req, res, next)
    await vi.waitFor(() => expect(res.send).toHaveBeenCalled())

    expect(res.send).toHaveBeenCalledWith(expect.stringContaining('<base href="/">'))
  })

  it('falls back to a root base href for an absolute-URL ingress path', async () => {
    const middleware = ingressBasePathMiddleware(publicDir)
    const req = makeRequest({ path: '/', header: () => 'https://evil.example' })
    const res = makeResponse()
    const next = vi.fn()

    middleware(req, res, next)
    await vi.waitFor(() => expect(res.send).toHaveBeenCalled())

    expect(res.send).toHaveBeenCalledWith(expect.stringContaining('<base href="/">'))
  })

  it('injects the base href into a head tag that carries attributes', async () => {
    fs.writeFileSync(path.join(publicDir, 'index.html'), '<!DOCTYPE html>\n<html>\n  <head lang="en">\n    <title>Kuroshiro</title>\n  </head>\n  <body></body>\n</html>\n')
    const middleware = ingressBasePathMiddleware(publicDir)
    const req = makeRequest({ path: '/' })
    const res = makeResponse()
    const next = vi.fn()

    middleware(req, res, next)
    await vi.waitFor(() => expect(res.send).toHaveBeenCalled())

    expect(res.send).toHaveBeenCalledWith(expect.stringContaining('<base href="/">'))
  })

  it('passes non-GET requests through untouched', () => {
    const middleware = ingressBasePathMiddleware(publicDir)
    const req = makeRequest({ method: 'POST', path: '/' })
    const res = makeResponse()
    const next = vi.fn()

    middleware(req, res, next)

    expect(next).toHaveBeenCalledOnce()
    expect(res.send).not.toHaveBeenCalled()
  })
})
