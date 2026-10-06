import type { AddressInfo } from 'node:net'
import type { Browser, Page } from 'playwright'
import type { RunningApi } from '../real-api/environment/api.ts'
import type { Database } from '../real-api/environment/database.ts'
import type { Shot } from './capture.ts'
import type { InstanceApi } from './instanceApi.ts'
import type { ShowcaseDevice, ShowcasePlugins } from './seed.ts'
import { once } from 'node:events'
import { createServer } from 'node:http'
import { setTimeout as sleep } from 'node:timers/promises'
import { chromium } from 'playwright'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildApi, freePort, runApi } from '../real-api/environment/api.ts'
import { startDatabase } from '../real-api/environment/database.ts'
import { capture } from './capture.ts'
import { FJORD_SVG, tideChartSvg } from './content.ts'
import { instanceApi } from './instanceApi.ts'
import { seedBedroom, seedHallway, seedKitchen, seedOffice, seedPlugins } from './seed.ts'

/** The Bedroom's refresh rate of a minute times the smallest offline multiplier, and a margin. */
const BEDROOM_OFFLINE_AFTER_MS = 2 * 60_000 + 10_000
/** Where a household would reach its Instance, behind a reverse proxy on the home network. */
const PUBLIC_URL = 'http://kuroshiro.home.arpa'
const ALERT_WAIT = { timeout: 60_000, interval: 1_000 }

async function rasterize(browser: Browser, svg: string) {
  const page = await browser.newPage({ viewport: { width: 800, height: 480 } })
  await page.setContent(`<body style="margin:0">${svg}</body>`)
  const png = await page.screenshot()
  await page.close()
  return png
}

/** A tide service on the network that publishes its chart as an image, which an External link Screen points at. */
async function serveImage(png: Uint8Array) {
  const server = createServer((_request, response) => response.writeHead(200, { 'Content-Type': 'image/png' }).end(png)).listen(0, '127.0.0.1')
  await once(server, 'listening')
  return { url: `http://127.0.0.1:${(server.address() as AddressInfo).port}/charts/elbe-st-pauli.png`, close: () => server.close() }
}

const heading = (page: Page, name: string) => page.getByRole('heading', { level: 1, name, exact: true }).waitFor()

describe('the showcase', () => {
  let database: Database
  let api: RunningApi
  let port: number
  let browser: Browser
  let instance: InstanceApi
  let tideChart: Awaited<ReturnType<typeof serveImage>>
  let plugins: ShowcasePlugins
  let kitchen: ShowcaseDevice

  const baseUrl = () => api.baseUrl

  /** The Alert Sweep runs at boot and then every five minutes on the clock, so a restart is the way to have it run now. */
  async function restart() {
    await api.stop()
    api = await runApi(database.env, port, PUBLIC_URL)
  }

  beforeAll(async () => {
    database = await startDatabase()
    buildApi()
    port = await freePort()
    api = await runApi(database.env, port, PUBLIC_URL)
    instance = instanceApi(api.baseUrl)
    browser = await chromium.launch()
    tideChart = await serveImage(await rasterize(browser, tideChartSvg()))
  }, 300_000)

  afterAll(async () => {
    tideChart?.close()
    await browser?.close()
    await api?.stop()
    database?.stop()
  })

  it('seeds a household of Devices, Screens and Plugins, with Alerts firing and one resolved', async () => {
    await instance.updateSettings({ offlineMultiplier: 2, fetchFailureThreshold: 1 })
    const bedroomSeenAt = Date.now()
    await seedBedroom(instance, baseUrl())
    plugins = await seedPlugins(instance, baseUrl())
    kitchen = await seedKitchen(instance, baseUrl(), plugins, { fjord: await rasterize(browser, FJORD_SVG), tideChartUrl: tideChart.url })
    const office = await seedOffice(instance, baseUrl(), plugins)
    await seedHallway(instance, baseUrl(), plugins)

    await expect.poll(async () => (await instance.plugin(plugins.waste.id)).dataSources[0]!.fetchFailureStreak, { timeout: 150_000, interval: 5_000 }).toBeGreaterThan(0)
    await sleep(Math.max(0, bedroomSeenAt + BEDROOM_OFFLINE_AFTER_MS - Date.now()))
    await restart()
    await expect.poll(async () => (await instance.alerts()).active.length, ALERT_WAIT).toBe(4)

    // The Office was charged: the next sweep resolves its low-battery Alert.
    await office.played.display({ ...office.report, 'battery-voltage': '4.08' })
    await restart()
    await expect.poll(async () => (await instance.alerts()).resolved.length, ALERT_WAIT).toBe(1)

    await instance.updatePlugin(plugins.waste.id, { refreshInterval: 60 })
  }, 600_000)

  it('shoots the pages', async () => {
    const devicePath = `devices/${kitchen.id}`
    const htmlScreen = (await instance.screensOf(kitchen.id)).find(screen => screen.kind === 'html')!
    const shots: Shot[] = [
      { name: 'devices', path: 'devices', ready: page => heading(page, 'Devices') },
      {
        name: 'device-screens',
        path: devicePath,
        ready: page => page.getByRole('img', { name: 'On Kitchen: Kitchen dashboard' }).first().waitFor(),
      },
      { name: 'add-screen', path: `${devicePath}/screens/new`, ready: page => heading(page, 'Kitchen') },
      {
        name: 'html-editor',
        path: `${devicePath}/screens/${htmlScreen.id}/html`,
        ready: page => page.getByRole('textbox', { name: 'HTML of Morning briefing' }).waitFor(),
      },
      { name: 'device-settings', path: `${devicePath}/settings`, ready: page => page.getByText('Refresh rate').first().waitFor() },
      { name: 'device-logs', path: `${devicePath}/logs`, ready: page => page.getByText('display poll, served Kitchen dashboard').waitFor() },
      { name: 'plugins', path: 'plugins', ready: page => page.getByText('Tram departures').first().waitFor() },
      { name: 'plugin', path: `plugins/${plugins.weather.id}`, ready: page => page.locator('#template iframe').last().waitFor() },
      { name: 'alerts', path: 'alerts', ready: page => page.getByRole('list', { name: 'Firing Alerts' }).waitFor() },
      { name: 'instance', path: 'instance/settings', ready: page => heading(page, 'Instance') },
      { name: 'connect', path: 'connect', ready: page => page.locator('h1').waitFor() },
    ]
    for (const shot of shots)
      await capture(browser, baseUrl(), shot)
  }, 600_000)
})
