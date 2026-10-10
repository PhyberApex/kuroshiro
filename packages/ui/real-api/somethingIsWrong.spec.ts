import type { AlertsList, DeviceSummary } from 'kuroshiro-shared'
import type { Browser } from 'playwright'
import { chromium } from 'playwright'
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { connectDevice } from './devicePlayer.ts'

const baseUrl = inject('baseUrl')

/** The real-API stage sets the Alert Sweep's schedule to every 5 seconds (`KUROSHIRO_ALERT_SWEEP_CRON`), so an Alert fires within a few sweeps of its cause. */
const ALERT_POLL_TIMEOUT_MS = 15_000
const TEST_TIMEOUT_MS = 30_000

/** 10 % by the shared voltage function, below the built-in threshold of 20 %. */
const LOW_BATTERY_VOLTAGE = '3.12'

async function firingAlerts() {
  const { active } = await (await fetch(new URL('api/alerts', baseUrl))).json() as AlertsList
  return active
}

describe('something is wrong', () => {
  let browser: Browser

  beforeAll(async () => {
    browser = await chromium.launch()
  })

  afterAll(() => browser.close())

  it('shows the bar\'s indicator once a Device\'s battery is low, lists the Alert with its cause and opens the Device, which shows the same Alert', async () => {
    const device = await connectDevice(baseUrl, { mac: 'A4:C1:38:5F:0D:01' })
    await device.display({ 'battery-voltage': LOW_BATTERY_VOLTAGE })
    const devices = await (await fetch(new URL('api/devices', baseUrl))).json() as DeviceSummary[]
    const { id, name } = devices.find(summary => summary.friendlyId === device.setup.friendly_id)!
    const page = await browser.newPage()
    await page.goto(new URL(`devices/${id}`, baseUrl).href)
    await page.getByRole('heading', { level: 1, name }).waitFor()

    await expect.poll(async () => (await firingAlerts()).some(alert => alert.deviceId === id), { timeout: ALERT_POLL_TIMEOUT_MS, interval: 1_000 }).toBe(true)
    // The shell asks again when the window regains the focus; the suite's own types have no DOM to say so in.
    await page.evaluate('window.dispatchEvent(new Event("focus"))')

    await page.getByRole('banner').getByRole('link', { name: /^\d+ Alerts? firing$/ }).click()
    await page.getByRole('heading', { level: 1, name: 'Alerts' }).waitFor()
    const row = page.getByRole('list', { name: 'Firing Alerts' }).getByRole('listitem').filter({ hasText: name })
    await expect.poll(() => row.textContent()).toContain('Alert: battery low')
    expect(await row.textContent()).toContain('Battery at 10 %, below 20 %')

    await row.getByRole('link', { name, exact: true }).click()
    await page.waitForURL(new URL(`devices/${id}`, baseUrl).href)
    await page.getByRole('heading', { level: 1, name }).waitFor()
    await page.getByRole('main').getByText('Alert: battery low').waitFor()
    await page.close()
  }, TEST_TIMEOUT_MS)
})
