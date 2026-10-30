import type { DeviceDetail, DeviceSummary } from 'kuroshiro-shared'
import type { Browser, Page } from 'playwright'
import { chromium } from 'playwright'
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { connectDevice } from './devicePlayer.ts'

const baseUrl = inject('baseUrl')

/** What a row of the settings says of its save: "Saving", "Saved", "Not saved. …", or nothing. */
async function stateOf(page: Page, label: string) {
  const row = page.locator('.setting-row').filter({ has: page.locator('.label', { hasText: label }) }).first()
  return (await row.locator('.save-state [role="status"]').textContent())?.replace(/\s+/g, ' ').trim()
}

async function sleepOf(id: string) {
  return (await (await fetch(new URL(`api/devices/${id}`, baseUrl))).json() as DeviceDetail).sleep
}

describe('sleep Mode', () => {
  let browser: Browser

  beforeAll(async () => {
    browser = await chromium.launch()
  })

  afterAll(() => browser.close())

  it('switches off and back on with the window it keeps', async () => {
    const device = await connectDevice(baseUrl, { mac: 'A4:C1:38:5F:0E:01' })
    const devices = await (await fetch(new URL('api/devices', baseUrl))).json() as DeviceSummary[]
    const { id } = devices.find(summary => summary.friendlyId === device.setup.friendly_id)!

    const page = await browser.newPage()
    const failures: string[] = []
    page.on('pageerror', error => failures.push(error.message))
    await page.goto(new URL(`devices/${id}/settings`, baseUrl).href)
    const sleepSwitch = page.getByRole('switch', { name: 'Sleep Mode' })

    await sleepSwitch.click()
    await expect.poll(() => stateOf(page, 'Sleep Mode')).toBe('Saved')
    await page.getByLabel('Sleep Mode from').fill('22:00')
    await page.keyboard.press('Enter')
    await expect.poll(() => stateOf(page, 'Window')).toBe('Saved')

    await sleepSwitch.click()
    await expect.poll(() => sleepOf(id)).toMatchObject({ enabled: false, start: '22:00', end: '06:00' })
    await sleepSwitch.click()

    await expect.poll(() => sleepOf(id)).toMatchObject({ enabled: true, start: '22:00', end: '06:00' })
    await expect.poll(() => stateOf(page, 'Sleep Mode')).toBe('Saved')
    await expect.poll(() => sleepSwitch.getAttribute('aria-checked')).toBe('true')
    await expect.poll(() => page.getByLabel('Sleep Mode from').inputValue()).toBe('22:00')
    expect(failures).toEqual([])
    await page.close()
  })
})
