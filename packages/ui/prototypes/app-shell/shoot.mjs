import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer'

const here = dirname(fileURLToPath(import.meta.url))
const out = process.argv[2] ?? join(here, 'shots')
const scenes = [
  { name: 'device-light', query: 'theme=light&devices=1&alert=1', hash: '#/', width: 1280 },
  { name: 'landing-dark', query: 'theme=dark&devices=3&alert=1', hash: '#/', width: 1280 },
  { name: 'instance-light', query: 'theme=light&devices=3&alert=0', hash: '#/instance/firmware', width: 1280 },
  { name: 'firstrun-light', query: 'theme=light&devices=0&alert=0', hash: '#/', width: 1280 },
  { name: 'phone-device', query: 'theme=light&devices=1&alert=1', hash: '#/', width: 390 },
  { name: 'phone-instance-dark', query: 'theme=dark&devices=3&alert=1', hash: '#/instance/firmware', width: 390 },
]
const shots = ['a', 'b', 'c'].flatMap(variant => scenes.map(scene => ({ ...scene, variant })))

const browser = await puppeteer.launch({ args: ['--no-sandbox'] })
const page = await browser.newPage()
for (const shot of shots) {
  await page.setViewport({ width: shot.width, height: shot.width < 500 ? 844 : 900, deviceScaleFactor: 1 })
  await page.goto('about:blank')
  await page.goto(`file://${join(here, 'index.html')}?variant=${shot.variant}&${shot.query}${shot.hash}`, { waitUntil: 'networkidle0' })
  await page.evaluate(() => document.fonts.ready)
  await page.addStyleTag({ content: '.proto-bar { display: none }' })
  await page.screenshot({ path: join(out, `${shot.variant}-${shot.name}.png`) })
}
await browser.close()
