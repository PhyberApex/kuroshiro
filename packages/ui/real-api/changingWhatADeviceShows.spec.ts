import type { DeviceSummary } from 'kuroshiro-shared'
import type { AddressInfo } from 'node:net'
import type { Browser } from 'playwright'
import { once } from 'node:events'
import { createServer } from 'node:http'
import { chromium } from 'playwright'
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { connectDevice } from './devicePlayer.ts'
import { addFileScreen, ONE_PIXEL_PNG, screenStates } from './screensOfDevice.ts'

const baseUrl = inject('baseUrl')

/** Another server on the network that answers every request with an image, as the address of an External link does. */
async function serveImage() {
  const server = createServer((_request, response) => response.writeHead(200, { 'Content-Type': 'image/png' }).end(ONE_PIXEL_PNG)).listen(0, '127.0.0.1')
  await once(server, 'listening')
  return { url: `http://127.0.0.1:${(server.address() as AddressInfo).port}/tide-table.png`, close: () => server.close() }
}

describe('changing what a Device shows', () => {
  let browser: Browser
  let image: Awaited<ReturnType<typeof serveImage>>

  beforeAll(async () => {
    browser = await chromium.launch()
    image = await serveImage()
  })

  afterAll(async () => {
    image.close()
    await browser.close()
  })

  it('adds an External link Screen at the end of the Order, leaves the Active Screen alone, and shows it once Rotation reaches it', async () => {
    const device = await connectDevice(baseUrl, { mac: 'A4:C1:38:5F:0C:02' })
    const devices = await (await fetch(new URL('api/devices', baseUrl))).json() as DeviceSummary[]
    const { id, name } = devices.find(summary => summary.friendlyId === device.setup.friendly_id)!
    await addFileScreen(baseUrl, id, 'Harbour photo')
    await device.display()

    const page = await browser.newPage()
    await page.goto(new URL(`devices/${id}`, baseUrl).href)
    await page.getByRole('img', { name: `On ${name}: Harbour photo` }).waitFor()

    await page.getByRole('link', { name: 'Add Screen' }).click()
    await page.getByRole('radio', { name: 'External link' }).click()
    await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Tide table')
    await page.getByRole('textbox', { name: 'Image URL' }).fill(image.url)
    await page.getByRole('button', { name: 'Add Screen' }).click()

    await page.getByRole('region', { name: 'Tide table', exact: true }).waitFor()
    expect(new URL(page.url()).searchParams.has('screen')).toBe(true)
    await expect.poll(() => screenStates(page)).toEqual({ 'Harbour photo': 'Active Screen', 'Tide table': 'Up next' })
    expect(Object.keys(await screenStates(page))).toEqual(['Harbour photo', 'Tide table'])
    await page.getByRole('img', { name: `On ${name}: Harbour photo` }).waitFor()

    await device.display()
    // The view asks again when the window regains the focus; the suite's own types have no DOM to say so in.
    await page.evaluate('window.dispatchEvent(new Event("focus"))')

    await page.getByRole('img', { name: `On ${name}: Tide table` }).waitFor()
    await expect.poll(() => screenStates(page)).toEqual({ 'Harbour photo': 'Up next', 'Tide table': 'Active Screen' })
    await page.close()
  })
})
