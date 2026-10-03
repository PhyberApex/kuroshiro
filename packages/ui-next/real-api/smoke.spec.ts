import type { DeviceSummary, InstanceSettingsResponse } from 'kuroshiro-shared'
import type { Browser } from 'playwright'
import { chromium } from 'playwright'
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { connectDevice } from './devicePlayer.ts'

const baseUrl = inject('baseUrl')

describe('the built UI on the real API', () => {
  let browser: Browser

  beforeAll(async () => {
    browser = await chromium.launch()
  })

  afterAll(() => browser.close())

  it('loads in a browser and reads the admin API from the page', async () => {
    const page = await browser.newPage()
    const failures: string[] = []
    page.on('pageerror', error => failures.push(error.message))
    page.on('requestfailed', request => failures.push(`${request.method()} ${request.url()}`))

    await page.goto(baseUrl)
    await expect.poll(() => page.locator('#app > *').count()).toBeGreaterThan(0)
    // Evaluated in the page, so the request resolves against the document base the way the UI's own requests do.
    const settings = await page.evaluate<InstanceSettingsResponse>(
      `fetch(new URL('api/settings', document.baseURI)).then(response => response.json())`,
    )

    expect(await page.title()).toBe('Kuroshiro')
    expect(settings.lowBatteryPercent.override).toBeNull()
    expect(settings.firmwareAutoUpdate.fallbackSource).toBe('default')
    expect(failures).toEqual([])
  })

  it('answers a Device that sets itself up, polls and logs', async () => {
    const device = await connectDevice(baseUrl, { mac: 'A4:C1:38:5F:0B:9E' })

    expect(device.setup.api_key).not.toBe('')
    expect(device.setup.image_url).toContain('/screens/')

    const display = await device.display({ 'battery-voltage': '4.05', 'rssi': '-61' })

    expect(display.image_url).toContain('/screens/')
    expect(display.refresh_rate).toBeGreaterThan(0)

    await device.log([{ id: 1, message: 'wifi connect failed', created_at: Math.floor(Date.now() / 1000) }])
    const devices = await (await fetch(new URL('api/devices', baseUrl))).json() as DeviceSummary[]
    const listed = devices.find(summary => summary.friendlyId === device.setup.friendly_id)

    expect(listed?.lastSeenAt).toEqual(expect.any(String))
    expect(listed?.rssi).toBe(-61)
    expect(listed?.currentScreen).toMatchObject({ kind: 'fallback', fallback: 'noScreen', reason: 'noScreens' })
  })
})
