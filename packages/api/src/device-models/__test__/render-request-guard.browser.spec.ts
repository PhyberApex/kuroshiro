import type { AddressInfo } from 'node:net'
import type { Page } from 'puppeteer'
import type { RenderRequestPolicy } from '../render-request-guard.js'
import http from 'node:http'
import os from 'node:os'
import { TRMNL_FRAMEWORK_VERSION, wrapInScreenShell } from 'kuroshiro-shared'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { makeDeviceModel, makePalette } from '../../test/fixtures.js'
import { isPrivateAddress } from '../../utils/ssrfGuard.js'
import { closeSharedBrowser, setRenderRequestPolicy, withSharedPage } from '../shared-browser.js'

/** One of this host's own private, non-loopback IPv4 addresses, if it has one. */
const OWN_PRIVATE_ADDRESS = Object.values(os.networkInterfaces()).flat().find(entry => entry && entry.family === 'IPv4' && !entry.internal && isPrivateAddress(entry.address))?.address

/** What a script in the page reads from `url`: the body, or `error` when the request failed. */
async function read(page: Page, url: string): Promise<string> {
  return page.evaluate(async (target) => {
    try {
      return await (await fetch(target)).text()
    }
    catch {
      return 'error'
    }
  }, url)
}

describe('render pages in a browser', () => {
  let server: http.Server
  let port: number
  const hits: string[] = []

  beforeAll(async () => {
    // Answers any origin, so a refused read is the guard's doing, not the same-origin policy's.
    server = http.createServer((request, response) => {
      hits.push(request.url ?? '')
      response.writeHead(200, { 'access-control-allow-origin': '*', 'content-type': 'text/html' })
      response.end('<p id="secret">api-key-1234</p>')
    })
    await new Promise<void>(resolve => server.listen(0, '0.0.0.0', resolve))
    port = (server.address() as AddressInfo).port
  })

  afterEach(() => {
    hits.length = 0
  })

  afterAll(async () => {
    await closeSharedBrowser()
    await new Promise(resolve => server.close(resolve))
  })

  function policy(overrides: Partial<RenderRequestPolicy> = {}): RenderRequestPolicy {
    return { demoMode: false, apiPort: port, apiUrl: 'https://kuroshiro.example.com', allowedPrivateHosts: [], ...overrides }
  }

  it.each([false, true])('fails a script reading the API on localhost with a network error (demo mode %s)', async (demoMode) => {
    setRenderRequestPolicy(policy({ demoMode }))

    const body = await withSharedPage(async (page) => {
      await page.setContent('<html><body></body></html>', { waitUntil: 'load' })
      return read(page, `http://localhost:${port}/api/devices`)
    })

    expect(body).toBe('error')
    expect(hits).toEqual([])
  }, 30_000)

  it.runIf(OWN_PRIVATE_ADDRESS)('lets a script read a LAN host the allowlist names, which answers CORS, with web security on', async () => {
    setRenderRequestPolicy(policy({ apiPort: 1, allowedPrivateHosts: [OWN_PRIVATE_ADDRESS!] }))

    const body = await withSharedPage(async (page) => {
      await page.setContent('<html><body></body></html>', { waitUntil: 'load' })
      return read(page, `http://${OWN_PRIVATE_ADDRESS}:${port}/forecast`)
    })

    expect(body).toContain('api-key-1234')
  }, 30_000)

  it.runIf(OWN_PRIVATE_ADDRESS)('fails a script reading a LAN host no allowlist names', async () => {
    setRenderRequestPolicy(policy({ apiPort: 1 }))

    const body = await withSharedPage(async (page) => {
      await page.setContent('<html><body></body></html>', { waitUntil: 'load' })
      return read(page, `http://${OWN_PRIVATE_ADDRESS}:${port}/forecast`)
    })

    expect(body).toBe('error')
    expect(hits).toEqual([])
  }, 30_000)

  it.runIf(OWN_PRIVATE_ADDRESS)('draws nothing a demo-mode preview fetches or frames from a private address', async () => {
    setRenderRequestPolicy(policy({ demoMode: true, apiPort: 1 }))
    const privateUrl = `http://${OWN_PRIVATE_ADDRESS}:${port}/`

    const { body, metadata, framed } = await withSharedPage(async (page) => {
      await page.setContent(`<html><body><iframe src="${privateUrl}frame"></iframe><iframe src="http://127.0.0.1:${port}/frame"></iframe></body></html>`, { waitUntil: 'load' })
      const framed = await Promise.all(page.frames().slice(1).map(frame => frame.evaluate(() => document.body?.textContent ?? '').catch(() => '')))
      return { body: await read(page, `${privateUrl}data`), metadata: await read(page, 'http://169.254.169.254/latest/meta-data/'), framed }
    })

    expect(body).toBe('error')
    expect(metadata).toBe('error')
    expect(framed.join('')).not.toContain('api-key-1234')
    expect(hits).toEqual([])
  }, 30_000)

  it.runIf(OWN_PRIVATE_ADDRESS)('opens no window a script asks for, which no guard would watch', async () => {
    setRenderRequestPolicy(policy({ apiPort: 1, allowedPrivateHosts: [OWN_PRIVATE_ADDRESS!] }))
    const url = `http://${OWN_PRIVATE_ADDRESS}:${port}/popup`

    await withSharedPage(async (page) => {
      await page.setContent(`<html><body><a id="out" href="${url}-link" target="_blank">out</a><script>window.open('${url}'); document.getElementById('out').click()</script></body></html>`, { waitUntil: 'load' })
      await new Promise(resolve => setTimeout(resolve, 1_000))
    })

    expect(hits).toEqual([])
  }, 30_000)

  it('still loads the TRMNL framework CSS and JS', async () => {
    setRenderRequestPolicy(policy({ demoMode: true }))
    const target = { model: makeDeviceModel({ width: 800, height: 480 }), palette: makePalette() }

    const { finished, failed } = await withSharedPage(async (page) => {
      const finished: string[] = []
      const failed: string[] = []
      page.on('requestfinished', request => finished.push(request.url()))
      page.on('requestfailed', request => failed.push(request.url()))
      await page.setContent(wrapInScreenShell(target, '<div class="view view--full"></div>', TRMNL_FRAMEWORK_VERSION), { waitUntil: 'load' })
      return { finished, failed }
    })

    expect(failed).toEqual([])
    expect(finished).toEqual(expect.arrayContaining([
      `https://trmnl.com/css/${TRMNL_FRAMEWORK_VERSION}/plugins.css`,
      `https://trmnl.com/js/${TRMNL_FRAMEWORK_VERSION}/plugins.js`,
    ]))
  }, 30_000)
})
