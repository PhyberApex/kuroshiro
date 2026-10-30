import type { DeviceDetail, DeviceSummary } from 'kuroshiro-shared'
import type { Browser, Page } from 'playwright'
import { chromium } from 'playwright'
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { connectDevice } from './devicePlayer.ts'

const baseUrl = inject('baseUrl')

/** What a settings row says of its save: "Saving", "Saved", "Not saved. …", or nothing. */
async function saveStateOf(page: Page, label: string) {
  const row = page.locator('.setting-row').filter({ has: page.locator('.label').getByText(label, { exact: true }) })
  return (await row.locator('.save-state [role="status"]').textContent())?.replace(/\s+/g, ' ').trim()
}

async function storedSleep(id: string) {
  return (await (await fetch(new URL(`api/devices/${id}`, baseUrl))).json() as DeviceDetail).sleep
}

describe('the built UI on the real API', () => {
  let browser: Browser

  beforeAll(async () => {
    browser = await chromium.launch()
  })

  afterAll(() => browser.close())

  it('opens a deep link, and names a Device in the bar once it has set itself up', async () => {
    const device = await connectDevice(baseUrl, { mac: 'A4:C1:38:5F:0B:9D' })
    const page = await browser.newPage()

    await page.goto(new URL('instance/firmware', baseUrl).href)
    const bar = page.getByRole('banner').getByRole('navigation', { name: 'Main' })
    await bar.getByRole('link', { name: 'Instance' }).and(page.locator('[aria-current="page"]')).waitFor()
    const devices = await (await fetch(new URL('api/devices', baseUrl))).json() as DeviceSummary[]
    const listed = devices.find(summary => summary.friendlyId === device.setup.friendly_id)!

    await bar.getByRole('link', { name: listed.name }).waitFor()
    expect(await bar.getByRole('link', { name: listed.name }).getAttribute('href')).toBe(`/devices/${listed.id}`)
    await page.close()
  })

  it('works under the prefix of an ingress proxy', async () => {
    const prefix = '/api/hassio_ingress/kuroshiro'
    const page = await browser.newPage({ extraHTTPHeaders: { 'X-Ingress-Path': prefix } })
    const failures: string[] = []
    page.on('pageerror', error => failures.push(error.message))
    page.on('requestfailed', request => failures.push(`${request.method()} ${request.url()}`))
    // The proxy strips its prefix before the request reaches Kuroshiro.
    await page.route(`**${prefix}/**`, route => route.continue({ url: route.request().url().replace(prefix, '') }))

    await page.goto(new URL(`${prefix}/plugins`, baseUrl).href)
    const bar = page.getByRole('banner').getByRole('navigation', { name: 'Main' })
    await bar.getByRole('link', { name: 'Plugins' }).and(page.locator('[aria-current="page"]')).waitFor()

    expect(await bar.getByRole('link', { name: 'Plugins' }).getAttribute('href')).toBe(`${prefix}/plugins`)
    expect(await page.getByRole('banner').getByRole('link', { name: 'Kuroshiro' }).getAttribute('href')).toBe(`${prefix}/`)

    await bar.getByRole('link', { name: 'Instance' }).click()
    await page.waitForURL(`**${prefix}/instance/settings`)
    expect(failures).toEqual([])
    await page.close()
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

  it('points a Device at images that exist', async () => {
    const device = await connectDevice(baseUrl, { mac: 'A4:C1:38:5F:0B:9F' })
    const display = await device.display()

    for (const imageUrl of [device.setup.image_url, display.image_url]) {
      const image = await fetch(imageUrl)
      expect(image.status).toBe(200)
      expect(image.headers.get('content-type')).toBe('image/png')
    }
  })

  // The API checks a switch-on against the request, not the Device, which the page specs' fake API does not.
  it('switches Sleep Mode off and back on, keeping its window', async () => {
    const device = await connectDevice(baseUrl, { mac: 'A4:C1:38:5F:0B:A0' })
    const devices = await (await fetch(new URL('api/devices', baseUrl))).json() as DeviceSummary[]
    const { id } = devices.find(summary => summary.friendlyId === device.setup.friendly_id)!
    const page = await browser.newPage()
    const failures: string[] = []
    page.on('pageerror', error => failures.push(error.message))
    await page.goto(new URL(`devices/${id}/settings`, baseUrl).href)
    const sleepSwitch = page.getByRole('switch', { name: 'Sleep Mode' })

    // The first switch-on takes the window 23:00 to 06:00.
    await sleepSwitch.click()
    await expect.poll(() => saveStateOf(page, 'Sleep Mode')).toBe('Saved')
    await page.getByLabel('Sleep Mode from').fill('22:00')
    await page.keyboard.press('Enter')
    await expect.poll(() => saveStateOf(page, 'Window')).toBe('Saved')

    await sleepSwitch.click()
    await expect.poll(() => saveStateOf(page, 'Sleep Mode')).toBe('Saved')
    expect(await storedSleep(id)).toMatchObject({ enabled: false, start: '22:00', end: '06:00' })
    await sleepSwitch.click()

    await expect.poll(() => storedSleep(id)).toMatchObject({ enabled: true, start: '22:00', end: '06:00' })
    await expect.poll(() => sleepSwitch.getAttribute('aria-checked')).toBe('true')
    expect(failures).toEqual([])
    await page.close()
  })

  it.each(['welcome', 'noScreen', 'error', 'sleep'])('serves the static %s Fallback Screen without the UI shipping it', async (kind) => {
    const image = await fetch(new URL(`screens/${kind}.png`, baseUrl))

    expect(image.status).toBe(200)
    expect(image.headers.get('content-type')).toBe('image/png')
  })
})
