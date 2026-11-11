import type { INestApplication } from '@nestjs/common'
import type { AddressInfo } from 'node:net'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { NestFactory } from '@nestjs/core'
import { ServeStaticModule } from '@nestjs/serve-static'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ingressBasePathMiddleware, setUiAssetHeaders } from '../ingress-base-path.middleware.js'

describe('the security headers the app shell is served with', () => {
  let publicDir: string
  let app: INestApplication
  let baseUrl: string

  beforeAll(async () => {
    publicDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kuroshiro-shell-headers-'))
    fs.writeFileSync(path.join(publicDir, 'index.html'), '<!DOCTYPE html>\n<html>\n  <head>\n    <title>Kuroshiro</title>\n  </head>\n  <body></body>\n</html>\n')
    fs.mkdirSync(path.join(publicDir, 'screens'))
    fs.writeFileSync(path.join(publicDir, 'screens', 'screen.png'), 'not really a png')
    fs.mkdirSync(path.join(publicDir, 'assets'))
    fs.writeFileSync(path.join(publicDir, 'assets', 'index-abc123.js'), 'export {}')
    // Wired as main.ts and app.module.ts wire them: the middleware ahead of ServeStatic. Booted
    // through NestFactory, as main.ts is, because a testing module builds ServeStatic's loader
    // before there is an HTTP adapter and so serves no files at all.
    app = await NestFactory.create(
      ServeStaticModule.forRoot({ rootPath: publicDir, serveStaticOptions: { setHeaders: setUiAssetHeaders } }),
      { logger: false },
    )
    app.use(ingressBasePathMiddleware(publicDir))
    await app.listen(0)
    baseUrl = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`
  })

  afterAll(async () => {
    await app.close()
    fs.rmSync(publicDir, { recursive: true, force: true })
  })

  function expectShellHeaders(response: Response) {
    expect(response.status).toBe(200)
    expect(response.headers.get('content-security-policy')).toBe('frame-ancestors \'self\'')
    expect(response.headers.get('x-frame-options')).toBe('SAMEORIGIN')
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
    expect(response.headers.get('referrer-policy')).toBe('same-origin')
  }

  it('frames GET / only from its own origin', async () => {
    expectShellHeaders(await fetch(`${baseUrl}/`))
  })

  it('carries the same headers on index.html served under an ingress prefix', async () => {
    // Home Assistant's ingress proxy strips its prefix and names it in X-Ingress-Path.
    const response = await fetch(`${baseUrl}/plugins`, { headers: { 'X-Ingress-Path': '/api/hassio_ingress/some-token' } })

    expectShellHeaders(response)
    expect(await response.text()).toContain('<base href="/api/hassio_ingress/some-token/">')
  })

  it('carries the same headers on the index.html ServeStatic falls back to for a missing dotted path', async () => {
    expectShellHeaders(await fetch(`${baseUrl}/no-such-file.txt`))
  })

  it('serves the UI\'s scripts with nosniff', async () => {
    const response = await fetch(`${baseUrl}/assets/index-abc123.js`)

    expect(response.status).toBe(200)
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
  })

  it('leaves a screen image a Device fetches without them', async () => {
    const response = await fetch(`${baseUrl}/screens/screen.png`)

    expect(response.status).toBe(200)
    expect(response.headers.get('content-security-policy')).toBeNull()
    expect(response.headers.get('x-frame-options')).toBeNull()
    expect(response.headers.get('x-content-type-options')).toBeNull()
  })
})
