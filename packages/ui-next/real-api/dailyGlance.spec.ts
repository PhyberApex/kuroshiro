import type { DeviceSummary, ScreenRead } from 'kuroshiro-shared'
import type { Browser, Page } from 'playwright'
import { Buffer } from 'node:buffer'
import { chromium } from 'playwright'
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { connectDevice } from './devicePlayer.ts'

const baseUrl = inject('baseUrl')

/** One pixel: the smallest image the server converts into a File Screen. */
const ONE_PIXEL_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')

async function addFileScreen(deviceId: string, name: string) {
  const form = new FormData()
  form.set('kind', 'file')
  form.set('deviceId', deviceId)
  form.set('name', name)
  form.set('file', new Blob([ONE_PIXEL_PNG], { type: 'image/png' }), `${name}.png`)
  const response = await fetch(new URL('api/screens', baseUrl), { method: 'POST', body: form })
  if (!response.ok)
    throw new Error(`Adding the Screen ${name} answered ${response.status}: ${await response.text()}`)
  return await response.json() as ScreenRead
}

/** The Screen State each row words, by the row's name. */
function screenStates(page: Page) {
  return page.locator('.screen-row').evaluateAll(rows => Object.fromEntries(rows.map(row => [
    row.querySelector('.trigger')?.textContent?.trim(),
    row.querySelector('.state')?.textContent?.trim(),
  ])))
}

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
    await addFileScreen(id, 'Harbour photo')
    await addFileScreen(id, 'Alps in March')

    await device.display()
    const page = await browser.newPage()
    await page.goto(new URL(`devices/${id}`, baseUrl).href)

    await page.getByRole('img', { name: `On ${name}: Harbour photo` }).waitFor()
    await page.getByText('The Current Screen. Order 1 of 2, on the Device since the').waitFor()
    expect(await page.getByRole('region', { name: 'Current Screen', exact: true }).textContent()).toContain('Up next: Alps in March')
    expect(await screenStates(page)).toEqual({ 'Harbour photo': 'Active Screen', 'Alps in March': 'Up next' })

    await device.display()
    // The view asks again when the window regains the focus; the suite's own types have no DOM to say so in.
    await page.evaluate('window.dispatchEvent(new Event("focus"))')

    await page.getByRole('img', { name: `On ${name}: Alps in March` }).waitFor()
    await page.getByText('The Current Screen. Order 2 of 2, on the Device since the').waitFor()
    expect(await page.getByRole('region', { name: 'Current Screen', exact: true }).textContent()).toContain('Up next: Harbour photo')
    expect(await screenStates(page)).toEqual({ 'Harbour photo': 'Up next', 'Alps in March': 'Active Screen' })
    await page.close()
  })
})
