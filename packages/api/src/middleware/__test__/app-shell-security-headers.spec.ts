import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import express from 'express'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ingressBasePathMiddleware } from '../ingress-base-path.middleware.js'

describe('the security headers the app shell is served with', () => {
  let publicDir: string
  let server: Server
  let baseUrl: string

  beforeAll(async () => {
    publicDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kuroshiro-shell-headers-'))
    fs.writeFileSync(path.join(publicDir, 'index.html'), '<!DOCTYPE html>\n<html>\n  <head>\n    <title>Kuroshiro</title>\n  </head>\n  <body></body>\n</html>\n')
    fs.mkdirSync(path.join(publicDir, 'screens'))
    fs.writeFileSync(path.join(publicDir, 'screens', 'screen.png'), 'not really a png')
    const app = express()
    app.use(ingressBasePathMiddleware(publicDir))
    app.use(express.static(publicDir))
    server = await new Promise<Server>((resolve) => {
      const listening = app.listen(0, '127.0.0.1', () => resolve(listening))
    })
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  })

  afterAll(async () => {
    await new Promise(resolve => server.close(resolve))
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

  it('leaves a screen image a Device fetches without them', async () => {
    const response = await fetch(`${baseUrl}/screens/screen.png`)

    expect(response.status).toBe(200)
    expect(response.headers.get('content-security-policy')).toBeNull()
    expect(response.headers.get('x-frame-options')).toBeNull()
  })
})
