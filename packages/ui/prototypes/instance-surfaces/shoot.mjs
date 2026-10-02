// PROTOTYPE for wayfinder ticket #1094. Shoots every view the spec refers to.
// Run from packages/ui with puppeteer installed: node prototypes/instance-surfaces/shoot.mjs
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer'

const here = dirname(fileURLToPath(import.meta.url))
const out = process.argv[2] ?? join(here, 'shots')
mkdirSync(out, { recursive: true })

const fk = key => `[data-fk="${key}"]`
const I = '#/instance'
// file, query, hash, clicks, options
const shots = [
  ['settings-light', '', `${I}/settings`],
  ['settings-dark-three', 'devices=3&theme=dark', `${I}/settings`],
  ['settings-invalid', '', `${I}/settings`, [], { viewport: true, type: [fk('setting-lowBatteryPercent'), '0'], blur: true }],
  ['settings-notifications-off', 'notify=off&alert=0', `${I}/settings`, [], { viewport: true, scrollTo: '#notifications' }],
  ['settings-test-sent', '', `${I}/settings`, [fk('test-')], { viewport: true, scrollTo: '#notifications', wait: 1100 }],
  ['settings-loading', 'load=loading', `${I}/settings`],
  ['firmware-light', 'devices=3', `${I}/firmware`, [fk('tuck-earlier')]],
  ['firmware-dark-auto', 'theme=dark', `${I}/firmware`, [fk('auto-')]],
  ['firmware-synced', 'devices=3&sync=new', `${I}/firmware`, [fk('auto-'), fk('sync-firmware')], { viewport: true, wait: 2300 }],
  ['firmware-sync-failed', 'sync=failed', `${I}/firmware`, [fk('sync-firmware')], { viewport: true, wait: 1100 }],
  ['firmware-empty', 'devices=0&fw=none&alert=0', `${I}/firmware`],
  ['firmware-failed', 'load=failed', `${I}/firmware`, [], { viewport: true }],
  ['firmware-upload', '', `${I}/firmware/upload`],
  ['confirm-delete-firmware', 'devices=3', `${I}/firmware`, [fk('delete-firmware-f171')], { viewport: true }],
  ['models-light', 'devices=3', `${I}/models`],
  ['models-all-dark', 'theme=dark', `${I}/models`, [fk('tuck-models'), fk('tuck-palettes')]],
  ['models-add-palette', '', `${I}/models`, [fk('palette-form-new')]],
  ['models-edit-palette', 'devices=3', `${I}/models`, [fk('palette-form-study-panel')], { viewport: true }],
  ['confirm-delete-palette', 'devices=3', `${I}/models`, [fk('delete-palette-study-panel')], { viewport: true }],
  ['archive-light', '', `${I}/archive`],
  ['archive-fresh-dark', 'devices=0&alert=0&theme=dark', `${I}/archive`],
  ['archive-checked', '', `${I}/archive`, [fk('archive-checking')], { wait: 1100 }],
  ['archive-imported', '', `${I}/archive`, [fk('archive-checking')], { wait: 1100, after2: [fk('archive-done')] }],
  ['archive-refused', 'archive=refused', `${I}/archive`, [fk('archive-checking')], { viewport: true, wait: 1100, scrollTo: '.notice' }],
  ['housekeeping-light', '', `${I}/housekeeping`, [fk('open-finding-files')]],
  ['housekeeping-screens-dark', 'theme=dark', `${I}/housekeeping`, [fk('pick-screens'), fk('open-finding-screens')]],
  ['housekeeping-clean', 'scan=clean', `${I}/housekeeping`],
  ['housekeeping-scanning', 'scan=scanning', `${I}/housekeeping`, [], { viewport: true }],
  ['confirm-cleanup', '', `${I}/housekeeping`, [fk('cleanup-')], { viewport: true }],
  ['confirm-retention', '', `${I}/housekeeping`, [fk('retention-')], { viewport: true, wait: 900 }],
  ['simulator-before', 'devices=3', `${I}/simulator`],
  ['simulator-polled', '', `${I}/simulator`, [fk('tuck-reports'), fk('poll-')]],
  ['simulator-pending-dark', 'devices=3&theme=dark', `${I}/simulator`, [], { select: [fk('sim-device'), 'hallway'], after2: [fk('poll-')] }],
  ['simulator-new', 'devices=0&alert=0', `${I}/simulator`, [fk('setup-')]],
  ['alerts-firing', 'devices=3', '#/alerts'],
  ['alerts-one-dark', 'theme=dark', '#/alerts'],
  ['alerts-quiet', 'alert=0&notify=off', '#/alerts'],
  ['alerts-nothing', 'alert=0&devices=0', '#/alerts'],
  ['alerts-loading', 'load=loading', '#/alerts'],
  ['alerts-failed', 'load=failed&devices=3', '#/alerts', [], { viewport: true }],
  ['demo-line', 'demo=1', `${I}/settings`, [], { viewport: true }],
  ['phone-settings', '', `${I}/settings`, [], { phone: true }],
  ['phone-firmware', 'devices=3&theme=dark', `${I}/firmware`, [], { phone: true }],
  ['phone-models', 'devices=3', `${I}/models`, [], { phone: true }],
  ['phone-archive', '', `${I}/archive`, [], { phone: true }],
  ['phone-housekeeping', '', `${I}/housekeeping`, [], { phone: true }],
  ['phone-simulator', '', `${I}/simulator`, [fk('poll-')], { phone: true }],
  ['phone-alerts', 'devices=3', '#/alerts', [], { phone: true }],
]

const only = process.argv[3]
const browser = await puppeteer.launch({ args: ['--no-sandbox', '--allow-file-access-from-files'] })
const page = await browser.newPage()
page.on('pageerror', error => console.error('page error:', error.message))
const click = async (file, selector) => {
  if (!(await page.$(selector)))
    return console.error(`${file}: nothing matches ${selector}`)
  await page.evaluate(s => document.querySelector(s).click(), selector)
}
for (const [file, query, hash, clicks = [], options = {}] of shots.filter(s => !only || s[0].includes(only))) {
  const width = options.phone ? 390 : 1280
  await page.setViewport({ width, height: options.phone ? 844 : 900, deviceScaleFactor: 2, hasTouch: Boolean(options.phone), isMobile: Boolean(options.phone) })
  const theme = query.includes('theme=') ? '' : '&theme=light'
  await page.goto('about:blank')
  await page.goto(`file://${join(here, 'index.html')}?${query}${theme}${hash}`, { waitUntil: 'networkidle0' })
  await page.evaluate(() => document.fonts.ready)
  await page.addStyleTag({ content: '.proto-bar { display: none } *, *::before, *::after { animation: none !important; transition: none !important } ' + (options.viewport ? '.btabs { position: sticky !important }' : ' .bar, .btabs { position: static !important }') })
  if (options.type) {
    await page.focus(options.type[0])
    await page.keyboard.type(options.type[1])
  }
  for (const selector of options.type ? options.after ?? [] : clicks)
    await click(file, selector)
  if (options.select)
    await page.select(...options.select)
  if (options.wait)
    await new Promise(resolve => setTimeout(resolve, options.wait))
  for (const selector of options.after2 ?? [])
    await click(file, selector)
  await page.evaluate(() => document.activeElement?.blur())
  if (options.scrollTo)
    await page.evaluate(s => document.querySelector(s)?.scrollIntoView({ block: 'start' }), options.scrollTo)
  await new Promise(resolve => setTimeout(resolve, 60))
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  if (overflow > 0)
    console.warn(`${file}: ${overflow}px horizontal overflow`)
  await page.screenshot({ path: join(out, `${file}.png`), fullPage: !options.viewport })
}
await browser.close()
