// PROTOTYPE for wayfinder ticket #1091. Shoots the sheet in light, dark and at phone width.
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer'

const here = dirname(fileURLToPath(import.meta.url))
const out = process.argv[2] ?? join(here, 'shots')
const shots = [
  { file: 'sheet-light', theme: 'light', width: 1280 },
  { file: 'sheet-dark', theme: 'dark', width: 1280 },
  { file: 'sheet-phone', theme: 'light', width: 390, touch: true },
]

const browser = await puppeteer.launch({ args: ['--no-sandbox'] })
const page = await browser.newPage()
for (const shot of shots) {
  await page.setViewport({ width: shot.width, height: 900, deviceScaleFactor: 2, hasTouch: Boolean(shot.touch), isMobile: Boolean(shot.touch) })
  await page.goto(`file://${join(here, 'index.html')}?theme=${shot.theme}`, { waitUntil: 'networkidle0' })
  await page.evaluate(() => document.fonts.ready)
  await page.addStyleTag({ content: '.themebtn { display: none } *, *::before, *::after { animation: none !important }' })
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  if (overflow > 0)
    console.warn(`${shot.file}: ${overflow}px horizontal overflow`)
  await page.screenshot({ path: join(out, `${shot.file}.png`), fullPage: true })
}
await browser.close()
