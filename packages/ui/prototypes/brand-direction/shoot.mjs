import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer'

const here = dirname(fileURLToPath(import.meta.url))
const out = process.argv[2] ?? join(here, 'shots')
const shots = [
  ...['a', 'b', 'c'].flatMap(variant => ['light', 'dark'].map(theme => ({ variant, theme, width: 1280, name: `${variant}-${theme}` }))),
  ...['a', 'b', 'c'].map(variant => ({ variant, theme: 'light', width: 390, name: `${variant}-phone` })),
]

const browser = await puppeteer.launch({ args: ['--no-sandbox'] })
const page = await browser.newPage()
for (const shot of shots) {
  await page.setViewport({ width: shot.width, height: 900, deviceScaleFactor: 1 })
  await page.goto(`file://${join(here, 'index.html')}?variant=${shot.variant}&theme=${shot.theme}`, { waitUntil: 'networkidle0' })
  await page.evaluate(() => document.fonts.ready)
  await page.addStyleTag({ content: '.proto-bar { display: none }' })
  await page.screenshot({ path: join(out, `${shot.name}.png`), fullPage: true })
}
await browser.close()
