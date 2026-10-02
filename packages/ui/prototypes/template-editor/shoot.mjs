// PROTOTYPE for wayfinder ticket #1095. Shoots every view the spec refers to.
// Run from packages/ui with puppeteer installed: node prototypes/template-editor/shoot.mjs
// The preview loads TRMNL's framework from usetrmnl.com, so this needs the network.
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer'

const here = dirname(fileURLToPath(import.meta.url))
const out = process.argv[2] ?? join(here, 'shots')
mkdirSync(out, { recursive: true })

const W = '#/plugins/weather'
const act = (name, id) => `[data-act="${name}"]${id ? `[data-id="${id}"]` : ''}`
const breakLine = { replace: ['{% endfor %}', ''] }
// file, query, hash, options
const shots = [
  ['template-light', '', W, { viewport: true, scrollTo: '#template' }],
  ['template-dark', 'theme=dark', W, { viewport: true, scrollTo: '#template' }],
  ['template-page', '', W],
  ['template-one-device', 'devices=1', W, { viewport: true, scrollTo: '#template', clicks: [act('tuck-data')], open: ['forecast'] }],
  ['template-problem', '', W, { viewport: true, scrollTo: '#template', ...breakLine }],
  ['template-problem-dark', 'theme=dark', W, { viewport: true, scrollTo: '#template', ...breakLine }],
  ['template-unsaved', '', W, { viewport: true, scrollTo: '#template', replace: ['km/h wind', 'km/h'] }],
  ['template-quadrant', '', W, { viewport: true, scrollTo: '#template', clicks: [act('layout', 'quadrant')] }],
  ['template-add-menu', '', W, { viewport: true, scrollTo: '#template', clicks: [act('add-menu')] }],
  ['template-removed', '', W, { viewport: true, scrollTo: '#template', clicks: [act('layout', 'quadrant'), act('remove-layout')] }],
  ['template-another-model', '', W, { viewport: true, scrollTo: '#template', select: ['#pv-for', ''], select2: ['[data-field="model"]', 'seeed_e1002'] }],
  ['template-hallway', '', W, { viewport: true, scrollTo: '#template', select: ['#pv-for', 'hallway'] }],
  ['template-no-devices', 'devices=0', W, { viewport: true, scrollTo: '#template' }],
  ['template-fetch-failed', 'data=failed', W, { viewport: true, scrollTo: '#template', clicks: [act('tuck-data')], open: ['forecast'] }],
  ['template-fetching', 'data=fetching', W, { viewport: true, scrollTo: '#template' }],
  ['template-down', 'data=down&theme=dark', W, { viewport: true, scrollTo: '#template' }],
  ['template-scheduled-failed', 'sched=1', W, { viewport: true }],
  ['template-complete', '', W, { viewport: true, scrollTo: '#template', complete: 'forecast.current.' }],
  ['template-search', '', W, { viewport: true, scrollTo: '#template', search: 'value' }],
  ['wide-light', 'wide=1', W, { viewport: true, big: true }],
  ['wide-dark-problem', 'wide=1&theme=dark', W, { viewport: true, big: true, ...breakLine }],
  ['wide-unsaved', 'wide=1', W, { viewport: true, big: true, replace: ['km/h wind', 'km/h'], open: ['forecast'] }],
  ['starter', 'devices=1', '#/plugins/sourdough', { viewport: true }],
  ['webhook', '', '#/plugins/doorbell', { viewport: true, clicks: [act('tuck-data')] }],
  ['code-inputs', '', W, { viewport: true, scrollTo: '#data' }],
  ['code-input-invalid', '', W, { viewport: true, scrollTo: '#data', breakJson: true }],
  ['html-screen', '', '#/devices/kitchen/html', { viewport: true }],
  ['html-screen-dark', 'theme=dark&devices=1', '#/devices/kitchen/html', { viewport: true }],
  ['phone-template', '', W, { phone: true }],
  ['phone-html', 'devices=1', '#/devices/kitchen/html', { phone: true }],
]

const only = process.argv[3]
const browser = await puppeteer.launch({ args: ['--no-sandbox', '--allow-file-access-from-files'] })
const page = await browser.newPage()
page.on('pageerror', error => console.error('page error:', error.message))
page.on('console', message => message.type() === 'error' && console.error('console:', message.text()))
const pause = ms => new Promise(resolve => setTimeout(resolve, ms))
const click = async (file, selector) => {
  if (!(await page.$(selector)))
    return console.error(`${file}: nothing matches ${selector}`)
  await page.evaluate(s => document.querySelector(s).click(), selector)
}
const drawn = () => page.waitForFunction(() => {
  const frame = document.querySelector('#frame')
  return frame.classList.contains('rendering') || (frame.querySelector('iframe') && !frame.querySelector('iframe.next'))
}, { timeout: 20000 }).catch(() => console.error('the preview was not drawn in 20 s'))

for (const [file, query, hash, options = {}] of shots.filter(s => !only || s[0].includes(only))) {
  const width = options.phone ? 390 : options.big ? 1600 : 1280
  await page.setViewport({ width, height: options.phone ? 844 : options.big ? 1000 : 900, deviceScaleFactor: 2, hasTouch: Boolean(options.phone), isMobile: Boolean(options.phone) })
  const theme = query.includes('theme=') ? '' : '&theme=light'
  await page.goto('about:blank')
  await page.goto(`file://${join(here, 'index.html')}?${query}${theme}${hash}`, { waitUntil: 'networkidle0' })
  await page.evaluate(() => document.fonts.ready)
  await page.addStyleTag({ content: '.proto-bar { display: none } *, *::before, *::after { animation: none !important; transition: none !important } .cm-cursorLayer { display: none !important } ' + (options.viewport ? '.btabs { position: sticky !important }' : ' .bar, .btabs { position: static !important }') })
  await drawn()
  for (const selector of options.clicks ?? [])
    await click(file, selector)
  for (const [selector, value] of [options.select, options.select2].filter(Boolean)) {
    await page.select(selector, value)
    await pause(100)
  }
  for (const name of options.open ?? [])
    await page.evaluate((n) => { document.querySelector(`[data-var="${n}"]`).open = true }, name)
  if (options.replace) {
    await page.evaluate(([from, to]) => {
      const view = KuroEditor.EditorView.findFromDOM(document.querySelector('#cm .cm-editor'))
      const at = view.state.doc.toString().indexOf(from)
      view.dispatch({ changes: { from: at, to: at + from.length, insert: to } })
    }, options.replace)
    await pause(1300)
  }
  if (options.breakJson) {
    await page.evaluate(() => {
      const view = KuroEditor.EditorView.findFromDOM(document.querySelector('#ed-headers .cm-editor'))
      view.dispatch({ changes: { from: view.state.doc.length - 2, to: view.state.doc.length, insert: ',\n' } })
      view.contentDOM.dispatchEvent(new FocusEvent('blur'))
    })
    await pause(900)
  }
  if (options.complete) {
    await page.evaluate(() => {
      const view = KuroEditor.EditorView.findFromDOM(document.querySelector('#cm .cm-editor'))
      const at = view.state.doc.toString().indexOf('<span class="label">{{ forecast.current.summary')
      view.dispatch({ changes: { from: at, insert: '{{  }}\n        ' }, selection: { anchor: at + 3 } })
      view.focus()
    })
    await page.keyboard.type(options.complete, { delay: 30 })
    await pause(600)
  }
  if (options.search) {
    await page.focus('#cm .cm-content')
    await page.keyboard.down('Control')
    await page.keyboard.press('f')
    await page.keyboard.up('Control')
    await page.keyboard.type(options.search)
    await pause(200)
  }
  await pause(400)
  await drawn()
  if (!options.complete && !options.search)
    await page.evaluate(() => document.activeElement?.blur())
  if (options.scrollTo)
    await page.evaluate(s => window.scrollTo(0, document.querySelector(s).getBoundingClientRect().top + window.scrollY - 76), options.scrollTo)
  await pause(250)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  if (overflow > 0)
    console.warn(`${file}: ${overflow}px horizontal overflow`)
  await page.screenshot({ path: join(out, `${file}.png`), fullPage: !options.viewport })
}
await browser.close()
