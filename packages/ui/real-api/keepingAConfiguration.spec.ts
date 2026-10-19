import type { DeviceSummary } from 'kuroshiro-shared'
import type { Browser, Page } from 'playwright'
import { readFile } from 'node:fs/promises'
import { chromium } from 'playwright'
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { connectDevice } from './devicePlayer.ts'
import { addExternalScreen, screenStates } from './screensOfDevice.ts'

const baseUrl = inject('baseUrl')

/** Every import onto an Instance that has the archive's Devices keeps their API keys (ADR-0039), so the page always says so. */
const API_KEYS_KEPT = 'Devices that already existed here kept their current API keys.'

async function devicesOfInstance() {
  return await (await fetch(new URL('api/devices', baseUrl))).json() as DeviceSummary[]
}

/** The Devices other journeys made, by id and name. */
async function otherDevices(id: string) {
  return (await devicesOfInstance()).filter(summary => summary.id !== id).map(summary => ({ id: summary.id, name: summary.name }))
}

/** What each row of the summary says, by its label. */
async function summaryOf(page: Page) {
  const rows = await page.getByRole('region', { name: 'Configuration Import' }).locator('.summary-row').all()
  return Object.fromEntries(await Promise.all(rows.map(async row => [
    (await row.locator('dt').textContent())?.trim(),
    (await row.locator('dd').textContent())?.replace(/\s+/g, ' ').trim(),
  ])))
}

describe('keeping a Configuration Archive', () => {
  let browser: Browser

  beforeAll(async () => {
    browser = await chromium.launch()
  })

  afterAll(() => browser.close())

  it('undoes a Screen\'s rename by a Configuration Import of the Configuration Archive exported before it, and imports the same archive again to the same end', async () => {
    const device = await connectDevice(baseUrl, { mac: 'A4:C1:38:5F:0D:03' })
    const { id, name } = (await devicesOfInstance()).find(summary => summary.friendlyId === device.setup.friendly_id)!
    const screen = await addExternalScreen(baseUrl, id, 'Before')
    const othersBefore = await otherDevices(id)

    const page = await browser.newPage()
    const failures: string[] = []
    page.on('pageerror', error => failures.push(error.message))
    page.on('requestfailed', request => failures.push(`${request.method()} ${request.url()}`))
    const exporting = page.getByRole('region', { name: 'Configuration Export' })
    const importing = page.getByRole('region', { name: 'Configuration Import' })

    await page.goto(new URL('instance/archive', baseUrl).href)
    const downloading = page.waitForEvent('download')
    await exporting.getByRole('group', { name: 'With its secrets' }).getByRole('button', { name: 'Export', exact: true }).click()
    const download = await downloading
    const archive = { name: download.suggestedFilename(), mimeType: 'application/zip', buffer: await readFile((await download.path())!) }
    expect(archive.name).toMatch(/\.zip$/)

    await page.goto(new URL(`devices/${id}?screen=${screen.id}`, baseUrl).href)
    await page.getByRole('region', { name: 'Before', exact: true }).getByRole('button', { name: 'Rename' }).click()
    await page.getByRole('textbox', { name: 'Name of Before' }).fill('After')
    await page.keyboard.press('Enter')
    await expect.poll(() => screenStates(page).then(Object.keys)).toEqual(['After'])

    await page.goto(new URL('instance/archive', baseUrl).href)
    await importing.getByLabel('Choose file').setInputFiles(archive)
    await importing.getByRole('button', { name: 'Import Configuration Archive' }).waitFor()
    await importing.getByText(archive.name, { exact: true }).waitFor()
    await importing.getByText(/^A Configuration Archive from Kuroshiro /).waitFor()
    const check = await summaryOf(page)
    expect(check.Adds).toBe('Nothing')
    expect(check.Overwrites).toContain(name)
    expect(check.Overwrites).toMatch(/\b\d+ Screens? .*that (is|are) already here under the same id\./)
    expect(check.Mind).toBe(API_KEYS_KEPT)

    await importing.getByRole('button', { name: 'Import Configuration Archive' }).click()
    const imported = await importing.getByRole('status').filter({ hasText: 'Imported.' }).textContent()
    const overwrote = Number(/^Imported\. Added 0 records and overwrote (\d+)\. The Instance Settings were replaced\.$/.exec(imported!.trim())?.[1])
    expect(overwrote).toBeGreaterThanOrEqual(2)
    expect(await summaryOf(page)).toEqual({ 'To do now': API_KEYS_KEPT })

    await importing.getByRole('button', { name: 'Import another' }).click()
    await importing.getByLabel('Choose file').setInputFiles(archive)
    await importing.getByRole('button', { name: 'Import Configuration Archive' }).waitFor()
    expect((await summaryOf(page)).Adds).toBe('Nothing')
    await importing.getByRole('button', { name: 'Import Configuration Archive' }).click()
    await importing.getByRole('status').filter({ hasText: `Imported. Added 0 records and overwrote ${overwrote}.` }).waitFor()

    await page.goto(new URL(`devices/${id}`, baseUrl).href)
    await expect.poll(() => screenStates(page).then(Object.keys)).toEqual(['Before'])
    expect(await otherDevices(id)).toEqual(othersBefore)
    expect(failures).toEqual([])
    await page.close()
  })
})
