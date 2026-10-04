import type { DeviceSummary, InstanceFacts } from 'kuroshiro-shared'
import type { Browser } from 'playwright'
import { chromium } from 'playwright'
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { connectDevice } from './devicePlayer.ts'

const baseUrl = inject('baseUrl')

describe('the first run', () => {
  let browser: Browser

  beforeAll(async () => {
    browser = await chromium.launch()
  })

  afterAll(() => browser.close())

  it('opens the shell on a fresh Instance and lands on Connect a Device', async () => {
    const page = await browser.newPage()
    const failures: string[] = []
    page.on('pageerror', error => failures.push(error.message))
    page.on('requestfailed', request => failures.push(`${request.method()} ${request.url()}`))

    await page.goto(baseUrl)
    const bar = page.getByRole('banner').getByRole('navigation', { name: 'Main' })
    await bar.getByRole('link', { name: 'Connect a Device' }).and(page.locator('[aria-current="page"]')).waitFor()

    expect(new URL(page.url()).pathname).toBe('/connect')
    expect(await bar.getByRole('link').allTextContents()).toEqual(['Connect a Device', 'Plugins', 'Instance'])
    expect(await page.getByRole('link', { name: /firing/ }).count()).toBe(0)
    expect(await page.getByText('This is the Kuroshiro demo.').count()).toBe(0)
    expect(failures).toEqual([])
    await page.close()
  })

  it('shows a Device that calls in on Connect a Device, where it is named and opened', async () => {
    const { serverUrl } = await (await fetch(new URL('api/instance', baseUrl))).json() as InstanceFacts
    const page = await browser.newPage()

    await page.goto(baseUrl)
    await page.getByRole('heading', { level: 1, name: 'Connect your Device' }).waitFor()
    await page.getByText(serverUrl, { exact: true }).waitFor()
    await page.getByText('Waiting for a Device to call in').waitFor()

    const device = await connectDevice(baseUrl, { mac: 'A4:C1:38:5F:0A:01' })

    const block = page.getByRole('region', { name: 'A Device called in' })
    await block.getByRole('link', { name: `Open ${device.setup.friendly_id}` }).waitFor()
    await page.getByText('Still listening, in case there is another one').waitFor()

    const name = block.getByRole('textbox', { name: 'Name' })
    expect(await name.inputValue()).toBe(device.setup.friendly_id)
    await name.fill('Kitchen')
    await name.press('Enter')
    await block.getByRole('link', { name: 'Open Kitchen' }).click()

    const devices = await (await fetch(new URL('api/devices', baseUrl))).json() as DeviceSummary[]
    const listed = devices.find(summary => summary.friendlyId === device.setup.friendly_id)!
    await page.waitForURL(`**/devices/${listed.id}`)
    await page.getByRole('heading', { level: 1, name: 'Kitchen' }).waitFor()
    expect(listed.name).toBe('Kitchen')
    await page.close()
  })
})
