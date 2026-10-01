import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer'

const here = dirname(fileURLToPath(import.meta.url))
const out = process.argv[2] ?? join(here, 'shots')
const perVariant = [
  { name: 'light', query: 'theme=light&alert=1&scene=day', hash: '#/', width: 1280 },
  { name: 'dark', query: 'theme=dark&alert=1&scene=day', hash: '#/', width: 1280 },
  { name: 'open-light', query: 'theme=light&alert=0&scene=day', hash: '#/', width: 1280, click: '[data-fk="sel-mashup"]' },
  { name: 'none-light', query: 'theme=light&alert=0&scene=none', hash: '#/', width: 1280 },
  { name: 'phone', query: 'theme=light&alert=1&scene=day', hash: '#/', width: 390 },
]
const shared = [
  { name: 'settings-light', query: 'theme=light&alert=1&scene=day', hash: '#/devices/kitchen/settings', width: 1280 },
  { name: 'logs-dark', query: 'theme=dark&alert=1&scene=day', hash: '#/devices/kitchen/logs', width: 1280 },
  { name: 'add-light', query: 'theme=light&alert=0&scene=day', hash: '#/devices/kitchen/add', width: 1280, click: '[data-fk="kind-html"]' },
  { name: 'empty-light', query: 'theme=light&alert=0&scene=empty', hash: '#/', width: 1280 },
  { name: 'sleep-dark', query: 'theme=dark&alert=0&scene=sleep', hash: '#/', width: 1280 },
  { name: 'phone-settings', query: 'theme=light&alert=1&scene=day', hash: '#/devices/kitchen/settings', width: 390 },
]
const shots = [
  ...['a', 'b', 'c'].flatMap(variant => perVariant.map(scene => ({ ...scene, variant, file: `${variant}-${scene.name}` }))),
  ...shared.map(scene => ({ ...scene, variant: 'a', file: `shared-${scene.name}` })),
]

const browser = await puppeteer.launch({ args: ['--no-sandbox'] })
const page = await browser.newPage()
for (const shot of shots) {
  await page.setViewport({ width: shot.width, height: shot.width < 500 ? 844 : 900, deviceScaleFactor: 1 })
  await page.goto('about:blank')
  await page.goto(`file://${join(here, 'index.html')}?variant=${shot.variant}&devices=1&${shot.query}${shot.hash}`, { waitUntil: 'networkidle0' })
  await page.evaluate(() => document.fonts.ready)
  if (shot.click)
    await page.click(shot.click)
  await page.addStyleTag({ content: '.proto-bar { display: none }' })
  const height = await page.evaluate(() => document.documentElement.scrollHeight)
  await page.setViewport({ width: shot.width, height, deviceScaleFactor: 1 })
  await page.evaluate(() => scrollTo(0, 0))
  await page.screenshot({ path: join(out, `${shot.file}.png`) })
}
await browser.close()
