// PROTOTYPE for wayfinder ticket #1092. Shoots every view the spec refers to.
// Run from packages/ui with puppeteer installed: node prototypes/device-surfaces/shoot.mjs
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer'

const here = dirname(fileURLToPath(import.meta.url))
const out = process.argv[2] ?? join(here, 'shots')
mkdirSync(out, { recursive: true })

const fk = key => `[data-fk="${key}"]`
const D = '#/devices/kitchen'
// file, query, hash, clicks, options
const shots = [
  ['screens-light', 'scene=day', D],
  ['screens-dark', 'scene=day&theme=dark', D],
  ['screens-plugin-skipping', 'scene=day', D, [fk('open-bins')]],
  ['screens-mashup', 'scene=day', D, [fk('open-mashup')]],
  ['screens-mashup-change-layout', 'scene=day', D, [fk('open-mashup'), fk('layout-open-mashup'), fk('layout-pick-1Lx2R')]],
  ['screens-file-replace', 'scene=day', D, [fk('open-photo'), fk('replace-open-photo'), fk('replace-choose-photo')]],
  ['screens-rename', 'scene=day', D, [fk('open-photo'), fk('rename-open-photo')]],
  ['screens-many', 'scene=many', D],
  ['screens-external-link', 'scene=many', D, [fk('open-tide')]],
  ['screens-html-date-range', 'scene=many', D, [fk('open-note')]],
  ['screens-hold-and-never-rendered', 'scene=many&theme=dark', D, [fk('open-pollen')]],
  ['screens-mirrored', 'scene=mirror', D],
  ['screens-proxied', 'scene=proxied&theme=dark', D],
  ['screens-mirroring-failed', 'scene=mirrorfail', D],
  ['screens-offline', 'scene=offline', D],
  ['screens-none', 'scene=none', D, [fk('open-calendar')]],
  ['screens-empty', 'scene=empty', D],
  ['screens-sleep', 'scene=sleep&theme=dark', D],
  ['screens-loading', 'scene=loading', D],
  ['screens-failed', 'scene=failed', D],
  ['confirm-delete-screen', 'scene=day', D, [fk('open-photo'), fk('delete-photo')], { viewport: true }],
  ['confirm-unassign', 'scene=day', D, [fk('open-weather'), fk('delete-weather')], { viewport: true }],
  ['confirm-remove-schedule', 'scene=day&theme=dark', D, [fk('open-calendar'), fk('sched-remove-calendar')], { viewport: true }],
  ['add-plugin', 'scene=day', `${D}/add`],
  ['add-plugin-none', 'scene=day&plugins=0', `${D}/add`],
  ['add-mashup', 'scene=day', `${D}/add`, [fk('add-kind-mashup'), fk('add-layout-2Tx1B')]],
  ['add-link', 'scene=day', `${D}/add`, [fk('add-kind-link')]],
  ['add-file', 'scene=day&theme=dark', `${D}/add`, [fk('add-kind-file')]],
  ['add-html', 'scene=day', `${D}/add`, [fk('add-kind-html')]],
  ['edit-html', 'scene=many', `${D}/edit/note`],
  ['settings-light', 'scene=day', `${D}/settings`, [fk('tuck-identity'), fk('tuck-special'), fk('tuck-danger')]],
  ['settings-dark', 'scene=day&theme=dark', `${D}/settings`],
  ['settings-proxied', 'scene=proxied', `${D}/settings`, [fk('tuck-special'), fk('tuck-danger')]],
  ['confirm-device-reset', 'scene=day', `${D}/settings`, [fk('tuck-danger'), fk('reset-kitchen')], { viewport: true }],
  ['confirm-delete-device', 'scene=day', `${D}/settings`, [fk('tuck-danger'), fk('delete-device-kitchen')], { viewport: true }],
  ['logs-light', 'scene=day', `${D}/logs`, [fk('log-open-6')], { viewport: true }],
  ['logs-dark-problems', 'scene=day&theme=dark', `${D}/logs`, [fk('log-level-problems')], { viewport: true }],
  ['logs-search', 'scene=day', `${D}/logs`, [], { viewport: true, type: [fk('log-q'), 'wifi'] }],
  ['logs-no-match', 'scene=day', `${D}/logs`, [], { viewport: true, type: [fk('log-q'), 'kernel panic'] }],
  ['confirm-clear-logs', 'scene=day', `${D}/logs`, [fk('clear-logs-kitchen')], { viewport: true }],
  ['devices-three', 'scene=day&devices=3', '#/devices'],
  ['devices-seven-dark', 'scene=offline&devices=7&theme=dark', '#/devices'],
  ['device-of-seven', 'scene=day&devices=7', '#/devices/office'],
  ['connect-first-run', 'devices=0', '#/'],
  ['connect-arrived', 'devices=0&theme=dark', '#/', [], { keys: ['p'] }],
  ['connect-by-hand', 'devices=1', '#/connect', [fk('tuck-byhand'), fk('random-mac-')]],
  ['missing', 'devices=3', '#/devices/attic'],
  ['phone-screens', 'scene=day', D, [], { phone: true }],
  ['phone-screens-open', 'scene=day&theme=dark', D, [fk('open-mashup')], { phone: true }],
  ['phone-mirrored', 'scene=mirror', D, [], { phone: true }],
  ['phone-add', 'scene=day', `${D}/add`, [fk('add-kind-mashup')], { phone: true }],
  ['phone-settings', 'scene=day', `${D}/settings`, [], { phone: true }],
  ['phone-logs', 'scene=day&theme=dark', `${D}/logs`, [fk('log-open-6')], { phone: true, viewport: true }],
  ['phone-devices', 'scene=day&devices=3', '#/devices', [], { phone: true }],
  ['phone-connect', 'devices=0', '#/', [], { phone: true }],
]

const only = process.argv[3]
const browser = await puppeteer.launch({ args: ['--no-sandbox', '--allow-file-access-from-files'] })
const page = await browser.newPage()
page.on('pageerror', error => console.error('page error:', error.message))
for (const [file, query, hash, clicks = [], options = {}] of shots.filter(s => !only || s[0].includes(only))) {
  const width = options.phone ? 390 : 1280
  await page.setViewport({ width, height: options.phone ? 844 : 900, deviceScaleFactor: 2, hasTouch: Boolean(options.phone), isMobile: Boolean(options.phone) })
  const theme = query.includes('theme=') ? '' : '&theme=light'
  await page.goto('about:blank')
  await page.goto(`file://${join(here, 'index.html')}?alert=1&${query}${theme}${hash}`, { waitUntil: 'networkidle0' })
  await page.evaluate(() => document.fonts.ready)
  await page.addStyleTag({ content: '.proto-bar { display: none } *, *::before, *::after { animation: none !important; transition: none !important } .btabs { position: sticky !important }' })
  for (const selector of clicks) {
    const found = await page.$(selector)
    if (!found) {
      console.error(`${file}: nothing matches ${selector}`)
      continue
    }
    await page.evaluate(s => document.querySelector(s).click(), selector)
  }
  for (const key of options.keys ?? [])
    await page.keyboard.press(key)
  if (options.type) {
    await page.focus(options.type[0])
    await page.keyboard.type(options.type[1])
  }
  await page.evaluate(() => document.activeElement?.blur())
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  if (overflow > 0)
    console.warn(`${file}: ${overflow}px horizontal overflow`)
  await page.screenshot({ path: join(out, `${file}.png`), fullPage: !options.viewport })
}
await browser.close()
