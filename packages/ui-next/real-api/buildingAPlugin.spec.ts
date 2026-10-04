import type { DeviceSummary, ScreenRead } from 'kuroshiro-shared'
import type { Browser, Page } from 'playwright'
import { chromium } from 'playwright'
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { connectDevice } from './devicePlayer.ts'

const baseUrl = inject('baseUrl')

/** The document the Template section's plate drew last. */
const drawn = (page: Page) => page.locator('#template iframe').last().getAttribute('srcdoc', { timeout: 1000 }).catch(() => null)

describe('building a Plugin', () => {
  let browser: Browser

  beforeAll(async () => {
    browser = await chromium.launch()
  })

  afterAll(() => browser.close())

  it('builds a Poll Plugin with a literal Data Source and a Template that reads it, sees the plate draw the value, saves, assigns it, and the Device\'s next poll is answered with that Screen', { timeout: 120_000 }, async () => {
    const device = await connectDevice(baseUrl, { mac: 'A4:C1:38:5F:0C:03' })
    const devices = await (await fetch(new URL('api/devices', baseUrl))).json() as DeviceSummary[]
    const { id, name } = devices.find(summary => summary.friendlyId === device.setup.friendly_id)!

    const page = await browser.newPage()
    await page.goto(new URL('plugins/new?way=poll', baseUrl).href)
    await page.getByRole('textbox', { name: 'Name' }).fill('Tide times')
    await page.getByRole('button', { name: 'Create Plugin' }).click()
    await page.getByRole('heading', { name: 'Tide times', level: 1 }).waitFor()
    await expect.poll(() => drawn(page)).toContain('<span class="title">Tide times</span>')

    await page.getByRole('button', { name: 'Add a Data Source' }).click()
    const source = page.getByRole('region', { name: 'source', exact: true })
    await source.getByRole('textbox', { name: 'Name' }).fill('tide')
    const tide = page.getByRole('region', { name: 'tide', exact: true })
    await tide.getByRole('radio', { name: 'Literal' }).click()
    await tide.getByRole('textbox', { name: 'Value' }).click()
    // Put in as one piece of text, so that the editor closes no bracket by itself.
    await page.keyboard.insertText('{ "next": "High water at 14:32" }')

    await page.getByRole('textbox', { name: 'Template of Tide times, Full' }).click()
    await page.keyboard.press('ControlOrMeta+a')
    await page.keyboard.insertText('<p class="title">{{ tide.next }}</p>')

    await expect.poll(() => drawn(page), { timeout: 15_000 }).toContain('<p class="title">High water at 14:32</p>')

    await page.getByRole('button', { name: 'Save Plugin' }).click()
    await page.getByText(/^Saved at/).waitFor()

    await page.goto(new URL(`devices/${id}/screens/new?kind=plugin`, baseUrl).href)
    await page.getByRole('radio', { name: 'Tide times' }).click()
    await page.getByRole('button', { name: 'Assign Plugin' }).click()
    await page.getByRole('region', { name: 'Tide times', exact: true }).waitFor()

    const answer = await device.display()

    const screens = await (await fetch(new URL(`api/devices/${id}/screens`, baseUrl))).json() as ScreenRead[]
    const tideTimes = screens.find(screen => screen.kind === 'plugin' && screen.name === 'Tide times')!
    expect(answer.image_url).toMatch(new RegExp(`/${tideTimes.id}\\.png$`))
    const image = await fetch(answer.image_url)
    expect([image.status, image.headers.get('content-type')]).toEqual([200, 'image/png'])
    // The view asks again when the window regains the focus; the suite's own types have no DOM to say so in.
    await page.evaluate('window.dispatchEvent(new Event("focus"))')
    await page.getByRole('img', { name: `On ${name}: Tide times` }).waitFor()
    await page.close()
  })
})
