import type { Browser, HTTPRequest, Page } from 'puppeteer'
import type { ViteDevServer } from 'vite'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer'
import { createServer } from 'vite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

/**
 * Real-browser regression check for the horizontal-overflow breaks tracked in
 * kuroshiro#733-#737 (and the umbrella issue kuroshiro#738): jsdom-based unit
 * tests never lay out CSS, so they can't catch a toolbar or app bar that only
 * overflows at a narrow viewport. This drives an actual Chromium page instead.
 */

const WIDTHS = [375, 768, 1280]
const VIEWPORT_HEIGHT = 900
const DEVICE_ID = 'e2e-device-1'

const ROUTES: { name: string, path: string }[] = [
  { name: 'Overview', path: '/' },
  { name: 'Device Details', path: `/devices/${DEVICE_ID}` },
  { name: 'Device Plugins', path: `/devices/${DEVICE_ID}/plugins` },
  { name: 'Plugins Overview', path: '/plugins' },
  { name: 'Plugin Create', path: '/plugins/create' },
  { name: 'Maintenance', path: '/maintenance' },
  { name: 'Virtual Device', path: '/virtualDevice' },
  { name: 'HTML Preview', path: '/htmlPreview' },
]

const API_FIXTURES: Record<string, unknown> = {
  '/api/devices': [{
    id: DEVICE_ID,
    name: 'Living Room TRMNL',
    friendlyId: 'ABCDEF',
    mac: 'AA:BB:CC:DD:EE:FF',
    apikey: 'e2e-api-key',
    batteryVoltage: '4.05',
    fwVersion: '1.5.2',
    refreshRate: 900,
    rssi: '-52',
    userAgent: 'ESP32',
    width: 800,
    height: 480,
    reportedModel: 'og',
    deviceModel: null,
    palette: null,
    mirrorEnabled: false,
    mirrorMac: '',
    mirrorApikey: '',
    specialFunction: 'none',
    resetDevice: false,
    updateFirmware: false,
    lastSeen: new Date().toISOString(),
  }],
  '/api/device-models': [],
  '/api/device-models/palettes': [],
  '/api/plugins': [{
    id: 'e2e-plugin-1',
    name: 'Weather',
    description: 'Shows the current forecast',
    kind: 'Poll',
    refreshInterval: 900,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }],
  [`/api/plugins/device/${DEVICE_ID}`]: [],
  [`/api/screens/device/${DEVICE_ID}`]: [],
  '/api/current_screen': {
    filename: 'placeholder.png',
    image_url: '/screens/placeholder.png',
    refresh_rate: 900,
    rendered_at: new Date().toISOString(),
  },
  '/api/maintenance/scan': {
    orphanedScreenFiles: [],
    orphanedDeviceDirs: [],
    brokenScreens: [],
    tempFiles: [],
    oldUploads: [],
    totalSize: 0,
    scannedAt: new Date().toISOString(),
  },
}

async function mockApi(page: Page) {
  await page.setRequestInterception(true)
  page.on('request', (request: HTTPRequest) => {
    const pathname = new URL(request.url()).pathname
    if (pathname in API_FIXTURES) {
      request.respond({
        status: 200,
        headers: {},
        contentType: 'application/json',
        body: JSON.stringify(API_FIXTURES[pathname]),
      })
      return
    }
    request.continue()
  })
}

interface OverflowReport {
  documentOverflow: number
  offenders: { selector: string, overflow: number }[]
}

/**
 * Vuetify's app bar and nav drawer are `position: fixed`, so an oversized child
 * never grows `documentElement`'s scrollWidth — it just gets clipped by the
 * viewport edge and disappears (this is how kuroshiro#733-#737 slipped through
 * page-level-only checks). These are the non-grid content boundaries #738 calls
 * out by name (toolbars, card headers, dialog content): checking scrollWidth
 * against clientWidth on each one catches a child that no longer fits, without
 * flagging elements that scroll or scale by design — a native input's own text
 * scroll, or ScreenFrame's `transform: scale()` preview, are never selected here.
 */
const OVERFLOW_CANDIDATE_SELECTOR = '.v-toolbar__content, .v-card-title, .v-card-actions, .v-card-text'

async function measureHorizontalOverflow(page: Page): Promise<OverflowReport> {
  return page.evaluate((selector) => {
    const root = document.documentElement
    const offenders: { selector: string, overflow: number }[] = []

    for (const el of document.querySelectorAll<HTMLElement>(selector)) {
      const overflowX = getComputedStyle(el).overflowX
      if (overflowX === 'auto' || overflowX === 'scroll')
        continue

      const overflow = el.scrollWidth - el.clientWidth
      if (overflow > 1) {
        const label = el.className ? `${el.tagName.toLowerCase()}.${String(el.className).replace(/\s+/g, '.')}` : el.tagName.toLowerCase()
        offenders.push({ selector: label, overflow })
      }
    }

    return {
      documentOverflow: root.scrollWidth - root.clientWidth,
      offenders,
    }
  }, OVERFLOW_CANDIDATE_SELECTOR)
}

describe('viewport overflow regression', () => {
  let viteServer: ViteDevServer
  let browser: Browser
  let baseUrl: string

  beforeAll(async () => {
    viteServer = await createServer({
      root: fileURLToPath(new URL('..', import.meta.url)),
      configFile: fileURLToPath(new URL('../vite.config.ts', import.meta.url)),
      logLevel: 'silent',
      server: { port: 0, strictPort: false },
    })
    await viteServer.listen()
    const address = viteServer.httpServer?.address()
    if (!address || typeof address === 'string')
      throw new Error('Vite dev server did not bind to a TCP port')
    baseUrl = `http://localhost:${address.port}`

    browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-web-security'] })
  })

  afterAll(async () => {
    await browser.close()
    await viteServer.close()
  })

  for (const route of ROUTES) {
    describe(route.name, () => {
      for (const width of WIDTHS) {
        it(`has no horizontal overflow at ${width}px`, async () => {
          const page = await browser.newPage()
          try {
            await mockApi(page)
            await page.setViewport({ width, height: VIEWPORT_HEIGHT })
            await page.goto(`${baseUrl}${route.path}`, { waitUntil: 'networkidle0' })
            await page.waitForSelector('#app', { timeout: 10_000 })

            const report = await measureHorizontalOverflow(page)

            expect(report.documentOverflow, `page scrolled horizontally by ${report.documentOverflow}px at ${width}px on ${route.path}`).toBeLessThanOrEqual(1)
            expect(report.offenders, `elements overflowed horizontally at ${width}px on ${route.path}: ${JSON.stringify(report.offenders)}`).toEqual([])
          }
          finally {
            await page.close()
          }
        })
      }
    })
  }
})
