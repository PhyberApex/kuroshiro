// PROTOTYPE for wayfinder ticket #1090 — throwaway, not production code.
// Renders the four Fallback Screens for a spread of Device Models and Palettes
// through the same steps as packages/api (puppeteer screenshot at the model's
// pixel size, then ImageMagick's remap onto the Palette's greys). The remap
// here is undithered: the screens are pure ink and paper, and Floyd-Steinberg
// only frays their edges (see shots/dither-vs-none.png).
// Run: node packages/ui/prototypes/fallback-screens/render.mjs
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer'
import { fallbackScreenHtml } from './template.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const out = join(here, 'out')

const PALETTES = {
  'bw': { label: '1-bit', grays: 2 },
  'gray-4': { label: '2-bit', grays: 4 },
  'color-24bit': { label: 'full colour', grays: null },
}

const TARGETS = [
  { model: 'tidbyt', label: 'Tidbyt, the smallest Device Model', width: 64, height: 32, palettes: ['color-24bit'] },
  { model: 'waveshare_5_8_bw', label: 'Waveshare 5.8", the smallest e-paper with greys', width: 648, height: 480, palettes: ['bw', 'gray-4'] },
  { model: 'og_plus', label: 'TRMNL OG', width: 800, height: 480, palettes: ['bw', 'gray-4'] },
  { model: 'remarkable_paper_2', label: 'reMarkable Paper 2, portrait', width: 1404, height: 1872, palettes: ['bw'] },
  { model: 'avalue_epd_42s', label: 'Avalue EPD-42S, the largest Device Model', width: 2880, height: 2160, palettes: ['bw', 'gray-4'] },
]

const KINDS = ['welcome', 'noScreen', 'error', 'sleep']

const FACTS = {
  deviceName: 'Kitchen',
  friendlyId: '4F2A1C',
  instanceUrl: 'http://kuroshiro.local',
  wakeTime: '07:00',
}

function grayLevelsHex(levels) {
  return Array.from({ length: levels }, (_, i) => {
    const value = Math.round((i * 255) / (levels - 1)).toString(16).padStart(2, '0')
    return `#${value}${value}${value}`
  })
}

function paletteOperators(paletteId) {
  const { grays } = PALETTES[paletteId]
  if (!grays)
    return ['-colorspace', 'sRGB', '-define', 'png:color-type=2']
  const colormap = join(out, `colormap-${paletteId}.png`)
  execFileSync('magick', ['-size', '1x1', ...grayLevelsHex(grays).map(c => `xc:${c}`), '+append', '-type', 'Palette', colormap])
  return ['-colorspace', 'Gray', '-dither', 'None', '-remap', colormap, '-define', `png:bit-depth=${Math.ceil(Math.log2(grays))}`, '-define', 'png:color-type=0']
}

mkdirSync(out, { recursive: true })
const browser = await puppeteer.launch({ args: ['--no-sandbox'] })
const page = await browser.newPage()
const rendered = []

for (const target of TARGETS) {
  for (const paletteId of target.palettes) {
    const dir = join(out, `${target.model}-${paletteId}`)
    mkdirSync(dir, { recursive: true })
    for (const kind of KINDS) {
      await page.setViewport({ width: target.width, height: target.height, deviceScaleFactor: 1 })
      await page.setContent(fallbackScreenHtml(kind, FACTS, target), { waitUntil: 'load' })
      await page.evaluate(() => document.fonts.ready)
      const source = join(dir, `${kind}.source.png`)
      const file = join(dir, `${kind}.png`)
      writeFileSync(source, await page.screenshot())
      execFileSync('magick', [`PNG:${source}`, '-background', 'white', '-alpha', 'remove', '-alpha', 'off', ...paletteOperators(paletteId), '-strip', `png:${file}`])
      rendered.push({ target, paletteId, kind, src: `out/${target.model}-${paletteId}/${kind}.png` })
    }
  }
}
await browser.close()

const groups = TARGETS.flatMap(target => target.palettes.map(paletteId => ({ target, paletteId })))
const sheet = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>PROTOTYPE: Fallback Screens in the Hanko identity</title>
<style>
  body { margin: 0; padding: 32px; background: #e9e9e6; color: #121212; font: 14px/1.45 system-ui, sans-serif; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  p { margin: 0 0 28px; max-width: 80ch; }
  h2 { font-size: 14px; margin: 36px 0 12px; padding-bottom: 6px; border-bottom: 2px solid #121212; }
  .row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; align-items: start; }
  figure { margin: 0; }
  img { display: block; max-width: 100%; height: auto; outline: 1px solid #b9b9b4; image-rendering: pixelated; }
  .tiny img { width: 256px; }
  figcaption { margin-top: 6px; font-size: 12px; }
</style>
</head>
<body>
<h1>PROTOTYPE: Fallback Screens in the Hanko identity</h1>
<p>Wayfinder ticket #1090. Every image below is the converted PNG a Device would receive, not the HTML. Open an image in its own tab to see it at the Device's real pixels.</p>
${groups.map(({ target, paletteId }) => `<h2>${target.label} · ${target.width}×${target.height} · ${PALETTES[paletteId].label}</h2>
<div class="row${target.width < 200 ? ' tiny' : ''}">
${rendered.filter(r => r.target === target && r.paletteId === paletteId).map(r => `<figure><a href="${r.src}"><img src="${r.src}" alt="${r.kind} Fallback Screen"></a><figcaption>${r.kind === 'noScreen' ? 'no-screen' : r.kind}</figcaption></figure>`).join('\n')}
</div>`).join('\n')}
</body>
</html>`
writeFileSync(join(here, 'index.html'), sheet)
console.log(`Rendered ${rendered.length} images. Open ${join(here, 'index.html')}`)
