// PROTOTYPE for wayfinder ticket #1105 — throwaway, not production code.
// Renders the error Fallback Screen's wordings (a failed mirror fetch, a
// Screen that could not be rendered, and the nameless last resort) through the
// same undithered steps as render.mjs.
// Run: node packages/ui/prototypes/fallback-screens/render-error.mjs
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer'
import { fallbackScreenHtml } from './template.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const out = join(here, 'out-error')

const TARGETS = [
  { model: 'og_plus', label: 'TRMNL OG · 800×480 · 1-bit', width: 800, height: 480 },
  { model: 'waveshare_5_8_bw', label: 'Smallest e-paper with greys · 648×480 · 1-bit', width: 648, height: 480 },
  { model: 'remarkable_paper_2', label: 'Portrait · 1404×1872 · 1-bit', width: 1404, height: 1872 },
]

const BASE = { deviceName: 'Kitchen', friendlyId: '4F2A1C', instanceUrl: 'http://kuroshiro.local', wakeTime: '07:00' }

const VARIANTS = [
  { id: 'mirror', caption: 'A failed mirror fetch', facts: { cause: 'mirror' } },
  { id: 'render', caption: 'A Screen that could not be rendered', facts: { cause: 'render', screenName: 'Weather' } },
  { id: 'render-long', caption: 'The same, with a long Screen name', facts: { cause: 'render', screenName: 'Berlin public transport departures from Alexanderplatz' } },
  { id: 'last-resort', caption: 'The static last resort, with no Device facts', facts: { cause: 'render', deviceName: '', instanceUrl: '' } },
]

mkdirSync(out, { recursive: true })
const colormap = join(out, 'colormap-bw.png')
execFileSync('magick', ['-size', '1x1', 'xc:#000000', 'xc:#ffffff', '+append', '-type', 'Palette', colormap])

const browser = await puppeteer.launch({ args: ['--no-sandbox'] })
const page = await browser.newPage()
const rendered = []

for (const target of TARGETS) {
  for (const variant of VARIANTS) {
    await page.setViewport({ width: target.width, height: target.height, deviceScaleFactor: 1 })
    await page.setContent(fallbackScreenHtml('error', { ...BASE, ...variant.facts }, target), { waitUntil: 'load' })
    await page.evaluate(() => document.fonts.ready)
    const name = `${target.model}-${variant.id}`
    const source = join(out, `${name}.source.png`)
    const file = join(out, `${name}.png`)
    writeFileSync(source, await page.screenshot())
    execFileSync('magick', [`PNG:${source}`, '-background', 'white', '-alpha', 'remove', '-alpha', 'off', '-colorspace', 'Gray', '-dither', 'None', '-remap', colormap, '-define', 'png:bit-depth=1', '-define', 'png:color-type=0', '-strip', `png:${file}`])
    rendered.push({ target, variant, src: `out-error/${name}.png` })
  }
}
await browser.close()

const sheet = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>PROTOTYPE: the error Fallback Screen's wordings</title>
<style>
  body { margin: 0; padding: 32px; background: #e9e9e6; color: #121212; font: 14px/1.45 system-ui, sans-serif; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  p { margin: 0 0 28px; max-width: 80ch; }
  h2 { font-size: 14px; margin: 36px 0 12px; padding-bottom: 6px; border-bottom: 2px solid #121212; }
  .row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; align-items: start; }
  figure { margin: 0; }
  img { display: block; max-width: 100%; height: auto; outline: 1px solid #b9b9b4; }
  figcaption { margin-top: 6px; font-size: 12px; }
</style>
</head>
<body>
<h1>PROTOTYPE: the error Fallback Screen's wordings</h1>
<p>Wayfinder ticket #1105. Every image is the converted PNG a Device would receive.</p>
${TARGETS.map(target => `<h2>${target.label}</h2>
<div class="row">
${rendered.filter(r => r.target === target).map(r => `<figure><a href="${r.src}"><img src="${r.src}" alt="${r.variant.caption}"></a><figcaption>${r.variant.caption}</figcaption></figure>`).join('\n')}
</div>`).join('\n')}
</body>
</html>`
writeFileSync(join(here, 'error.html'), sheet)
console.log(`Rendered ${rendered.length} images. Open ${join(here, 'error.html')}`)
