// PROTOTYPE for wayfinder ticket #1090 — throwaway, not production code.
// One Hanko system for the four Fallback Screens, drawn as a self-contained
// HTML document (fonts inlined, seal outlined, no network) at a Device Model's
// native pixel size.
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const fontData = name => readFileSync(join(here, 'fonts', name)).toString('base64')
const SEAL_CHARACTERS = readFileSync(join(here, 'fonts', 'seal-path.txt'), 'utf8')

const FONT_FACES = [
  ['Kuroshiro Display', 'archivo-condensed-800.woff'],
  ['Kuroshiro Text', 'archivo-500.woff'],
  ['Kuroshiro Mono', 'jetbrains-mono-500.woff'],
].map(([family, file]) => `@font-face { font-family: "${family}"; src: url(data:font/woff;base64,${fontData(file)}) format("woff"); }`).join('\n')

const SEAL = `<svg class="seal" viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="5"/><path class="seal-characters" d="${SEAL_CHARACTERS}"/></svg>`

// Below this short side nothing but the seal survives (the Tidbyt is 64x32).
const SEAL_ONLY_SHORT_SIDE = 200

const escapeHtml = value => String(value).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

const NOTICES = {
  noScreen: () => ({
    headline: 'No Screen to show',
    body: 'Add a Screen to this Device, or check the Schedules of the ones it has.',
  }),
  error: () => ({
    headline: 'Mirroring failed',
    body: 'Kuroshiro could not fetch this Device’s image from TRMNL. It tries again at the next refresh.',
  }),
  sleep: ({ wakeTime }) => ({
    headline: `Asleep until ${wakeTime}`,
    body: null,
  }),
}

const CSS = `
${FONT_FACES}
:root { --u: min(calc(100vw / 800), calc(100vh / 480)); --ink: #000; --paper: #fff; --rule: max(2px, round(calc(4 * var(--u)), 1px)); }
* { box-sizing: border-box; margin: 0; }
html, body { width: 100vw; height: 100vh; overflow: hidden; }
body { background: var(--paper); color: var(--ink); font-family: "Kuroshiro Text", sans-serif; }
body.sleep { --ink: #fff; --paper: #000; }
.seal { display: block; flex: none; fill: var(--ink); }
.seal-characters { fill: var(--paper); }
.word { font-family: "Kuroshiro Display", sans-serif; line-height: 1; letter-spacing: -0.015em; }
.mono { font-family: "Kuroshiro Mono", monospace; }

.sheet { height: 100%; padding: calc(48 * var(--u)) calc(56 * var(--u)) calc(44 * var(--u)); display: grid; grid-template-rows: 1fr auto; }
h1 { font-family: "Kuroshiro Display", sans-serif; font-weight: normal; font-size: calc(88 * var(--u)); line-height: 0.95; letter-spacing: -0.015em; max-width: calc(700 * var(--u)); text-wrap: balance; }
.body { margin-top: calc(22 * var(--u)); max-width: calc(600 * var(--u)); font-size: calc(27 * var(--u)); line-height: 1.3; }
.body .mono { display: block; margin-top: calc(6 * var(--u)); font-size: calc(26 * var(--u)); overflow-wrap: anywhere; }

footer { display: flex; align-items: flex-end; justify-content: space-between; gap: calc(32 * var(--u)); padding-top: calc(20 * var(--u)); border-top: var(--rule) solid var(--ink); }
.facts { min-width: 0; font-size: calc(24 * var(--u)); line-height: 1.3; }
.facts div { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.facts .mono { font-size: calc(21 * var(--u)); }
.signature { display: flex; align-items: flex-end; gap: calc(12 * var(--u)); }
.signature .word { font-size: calc(34 * var(--u)); }
.signature .seal { width: calc(60 * var(--u)); height: calc(60 * var(--u)); }

.lockup { display: flex; align-items: center; gap: calc(26 * var(--u)); padding-bottom: calc(30 * var(--u)); border-bottom: var(--rule) solid var(--ink); }
.lockup .seal { width: calc(112 * var(--u)); height: calc(112 * var(--u)); }
.lockup .word { font-size: calc(108 * var(--u)); }
.welcome .body { margin-top: calc(30 * var(--u)); font-size: calc(30 * var(--u)); }
.welcome footer { border-top: 0; padding-top: 0; }

.seal-only { height: 100%; display: grid; place-items: center; }
.seal-only .seal { height: 76vmin; width: 76vmin; }
`

const footer = (facts, signature) => `<footer>
  <div class="facts">${facts}</div>
  ${signature}
</footer>`

const SIGNATURE = `<div class="signature"><span class="word">Kuroshiro</span>${SEAL}</div>`

function welcomeSheet({ friendlyId, instanceUrl }) {
  return `<main class="sheet">
  <div>
    <div class="lockup">${SEAL}<span class="word">Kuroshiro</span></div>
    <p class="body">This Device is connected.<br>Add its first Screen at <span class="mono">${escapeHtml(instanceUrl)}</span></p>
  </div>
  ${footer(`<div class="mono">${escapeHtml(friendlyId)}</div>`, '')}
</main>`
}

function noticeSheet(kind, { deviceName, instanceUrl, wakeTime }) {
  const { headline, body } = NOTICES[kind]({ wakeTime })
  return `<main class="sheet">
  <div>
    <h1>${escapeHtml(headline)}</h1>
    ${body ? `<p class="body">${escapeHtml(body)}</p>` : ''}
  </div>
  ${footer(`<div>${escapeHtml(deviceName)}</div><div class="mono">${escapeHtml(instanceUrl)}</div>`, SIGNATURE)}
</main>`
}

/**
 * @param {'welcome' | 'noScreen' | 'error' | 'sleep'} kind
 * @param {{ deviceName: string, friendlyId: string, instanceUrl: string, wakeTime: string }} facts
 * @param {{ width: number, height: number }} size the Device Model's render size in pixels
 */
export function fallbackScreenHtml(kind, facts, size) {
  const sealOnly = Math.min(size.width, size.height) < SEAL_ONLY_SHORT_SIDE
  const content = sealOnly
    ? `<main class="seal-only">${SEAL}</main>`
    : kind === 'welcome' ? welcomeSheet(facts) : noticeSheet(kind, facts)
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><style>${CSS}</style></head>
<body class="${kind === 'sleep' ? 'sleep' : kind === 'welcome' ? 'welcome' : ''}">${content}</body>
</html>`
}
