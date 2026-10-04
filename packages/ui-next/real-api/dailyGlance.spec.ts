import type { DeviceSummary } from 'kuroshiro-shared'
import type { Browser } from 'playwright'
import { chromium } from 'playwright'
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { connectDevice } from './devicePlayer.ts'
import { addFileScreen, screenStates } from './screensOfDevice.ts'

const baseUrl = inject('baseUrl')

describe('the daily glance', () => {
  let browser: Browser

  beforeAll(async () => {
    browser = await chromium.launch()
  })

  afterAll(() => browser.close())

  it('shows the Current Screen, the Active Screen and "Up next" moving on as a Device with two Screens polls twice', async () => {
    const device = await connectDevice(baseUrl, { mac: 'A4:C1:38:5F:0C:01' })
    const devices = await (await fetch(new URL('api/devices', baseUrl))).json() as DeviceSummary[]
    const { id, name } = devices.find(summary => summary.friendlyId === device.setup.friendly_id)!
    await addFileScreen(baseUrl, id, 'Harbour photo')
    await addFileScreen(baseUrl, id, 'Alps in March')

    await device.display()
    const page = await browser.newPage()
    await page.goto(new URL(`devices/${id}`, baseUrl).href)

    await page.getByRole('img', { name: `On ${name}: Harbour photo` }).waitFor()
    await page.getByText('The Current Screen. Order 1 of 2, on the Device since the').waitFor()
    await expect.poll(() => page.getByRole('region', { name: 'Current Screen', exact: true }).textContent()).toContain('Up next: Alps in March')
    await expect.poll(() => screenStates(page)).toEqual({ 'Harbour photo': 'Active Screen', 'Alps in March': 'Up next' })

    await device.display()
    // The view asks again when the window regains the focus; the suite's own types have no DOM to say so in.
    await page.evaluate('window.dispatchEvent(new Event("focus"))')

    await page.getByRole('img', { name: `On ${name}: Alps in March` }).waitFor()
    await page.getByText('The Current Screen. Order 2 of 2, on the Device since the').waitFor()
    // The Device and its Screens are two reads, answered one after the other.
    await expect.poll(() => page.getByRole('region', { name: 'Current Screen', exact: true }).textContent()).toContain('Up next: Harbour photo')
    await expect.poll(() => screenStates(page)).toEqual({ 'Harbour photo': 'Up next', 'Alps in March': 'Active Screen' })
    await page.close()
  })
})
