// PROTOTYPE for wayfinder ticket #1093. Shoots every view the spec refers to.
// Run from packages/ui with puppeteer installed: node prototypes/plugin-surfaces/shoot.mjs
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer'

const here = dirname(fileURLToPath(import.meta.url))
const out = process.argv[2] ?? join(here, 'shots')
mkdirSync(out, { recursive: true })

const fk = key => `[data-fk="${key}"]`
const P = '#/plugins'
// file, query, hash, clicks, options
const shots = [
  ['list-light', 'devices=3', P],
  ['list-dark-problems', 'devices=3&theme=dark', P, [fk('filter-problems')]],
  ['list-few', 'plugins=few&alert=0', P],
  ['list-menu', 'devices=3', P, [fk('menu-calendar')], { viewport: true }],
  ['list-search-none', 'devices=3', P, [], { viewport: true, type: [fk('query'), 'stocks'] }],
  ['list-empty', 'plugins=none', P],
  ['list-loading', 'load=loading', P],
  ['list-failed', 'load=failed&devices=3', P, [], { viewport: true }],
  ['add-recipe', '', `${P}/new/recipe`],
  ['add-recipe-twice', 'theme=dark', `${P}/new/recipe`, [], { type: [fk('recipe-input'), 'https://trmnl.com/recipes/41120'] }],
  ['add-recipe-refused', '', `${P}/new/recipe`, [fk('create-recipe')], { type: [fk('recipe-input'), 'weather'], after: [fk('create-recipe')] }],
  ['add-file', '', `${P}/new/file`],
  ['add-github', '', `${P}/new/github`],
  ['add-poll-for-device', '', `${P}/new/poll/kitchen`],
  ['add-webhook', '', `${P}/new/webhook`, [fk('merge-stream')]],
  ['plugin-poll', 'devices=3', `${P}/weather`],
  ['plugin-poll-dark', 'devices=3&theme=dark', `${P}/calendar`, [fk('open-source-calendar-events')]],
  ['plugin-alert', '', `${P}/trains`, [fk('jump-source-trains-departures')]],
  ['plugin-streak', 'alert=0', `${P}/bins`, [fk('open-source-bins-collections')]],
  ['plugin-needs-values', '', `${P}/pollen`],
  ['plugin-webhook', 'devices=3', `${P}/doorbell`, [fk('reveal-doorbell')]],
  ['plugin-webhook-empty', 'theme=dark', `${P}/parcel`],
  ['plugin-unsaved', 'devices=3', `${P}/weather`, [fk('open-source-weather-forecast'), fk('remove-source-weather-forecast'), fk('field-switch-fv-weather-show_wind')], { viewport: true, scrollTo: '#values' }],
  ['plugin-saved', 'devices=3', `${P}/weather`, [fk('field-switch-fv-weather-show_wind'), fk('save-weather')], { viewport: true }],
  ['plugin-fields', '', `${P}/weather`, [fk('tuck-fields'), fk('edit-field-weather-units'), fk('tuck-details'), fk('tuck-danger')], { viewport: true, scrollTo: '#recipe' }],
  ['plugin-no-devices', 'devices=0', `${P}/moon`],
  ['plugin-loading', 'load=loading', `${P}/weather`],
  ['plugin-missing', '', `${P}/stocks`],
  ['confirm-unassign', 'devices=3', `${P}/weather`, [fk('unassign-weather-kitchen')], { viewport: true }],
  ['confirm-delete', '', `${P}/trains`, [fk('tuck-danger'), fk('delete-plugin-trains')], { viewport: true }],
  ['confirm-delete-in-mashup', '', P, [fk('menu-weather'), fk('delete-plugin-weather')], { viewport: true }],
  ['confirm-clear-payload', '', `${P}/doorbell`, [fk('clear-payload-doorbell')], { viewport: true }],
  ['confirm-regenerate', 'theme=dark', `${P}/doorbell`, [fk('regenerate-doorbell')], { viewport: true }],
  ['update-items', '', `${P}/weather/update`, [fk('open-item-t-full')]],
  ['update-conflict-dark', 'theme=dark', `${P}/weather/update`, [fk('open-item-ds-forecast')]],
  ['update-same', 'check=same', `${P}/weather/update`],
  ['update-no-snapshot', 'check=nosnapshot', `${P}/weather/update`],
  ['update-running', 'check=running', `${P}/weather/update`],
  ['update-failed', 'check=failed', `${P}/weather/update`],
  ['mashup-slot-failed', '', '#/cells'],
  ['phone-list', 'devices=3', P, [], { phone: true }],
  ['phone-plugin', '', `${P}/trains`, [fk('open-source-trains-departures')], { phone: true }],
  ['phone-webhook', 'theme=dark', `${P}/doorbell`, [], { phone: true }],
  ['phone-add', '', `${P}/new/recipe`, [], { phone: true }],
  ['phone-update', '', `${P}/weather/update`, [], { phone: true }],
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
