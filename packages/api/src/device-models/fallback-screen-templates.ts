import { FALLBACK_SCREEN_FONTS } from './fallback-screen-fonts.js'

/**
 * Bump whenever the drawing or its conversion changes so cached renders
 * regenerate. Baked into the cache path in fallback-screens.service.ts rather
 * than compared via mtime, since the template lives in compiled JS with no
 * source file to stat.
 */
export const FALLBACK_SCREEN_TEMPLATE_VERSION = 2

export type FallbackScreenRequest
  = | { kind: 'welcome' }
    | { kind: 'noScreen' }
    | { kind: 'sleep' }
    | { kind: 'error', cause: 'mirror' }
    | { kind: 'error', cause: 'render', screenName: string | null }

export interface FallbackScreenFacts {
  deviceName: string
  friendlyId: string
  instanceUrl: string
  /** `hh:mm` in the server's timezone, null for a Device without a sleep window. */
  wakeTime: string | null
}

export interface FallbackScreenSize {
  width: number
  height: number
}

const REFERENCE_SIZE = { width: 800, height: 480 }
const SEAL_ONLY_BELOW_SHORT_SIDE = 200
const SMALL_SEAL_GRID = 16
const SMALL_SEAL_SHARE_OF_SHORT_SIDE = 0.76

/** The one unit every measure on the sheet is a multiple of: 1 on a TRMNL OG, so other panels gain white space instead of another layout. */
function fallbackScreenUnit({ width, height }: FallbackScreenSize): number {
  return Math.min(width / REFERENCE_SIZE.width, height / REFERENCE_SIZE.height)
}

function isSealOnly({ width, height }: FallbackScreenSize): boolean {
  return Math.min(width, height) < SEAL_ONLY_BELOW_SHORT_SIDE
}

/** Whole multiples of the 16 px grid the small seal is drawn on, so its 2 px strokes land on device pixels. */
function smallSealSide({ width, height }: FallbackScreenSize): number {
  const available = Math.min(width, height) * SMALL_SEAL_SHARE_OF_SHORT_SIDE
  return Math.max(1, Math.floor(available / SMALL_SEAL_GRID)) * SMALL_SEAL_GRID
}

const SEAL_CHARACTERS = 'M13.77 31.8Q12.98 31.33 11.65 30.77Q10.31 30.21 9.18 29.94Q10.36 29.42 11.7 28.57Q13.03 27.72 14.22 26.82Q15.4 25.92 16.14 25.23H9.82V22.66H29.09V21.35H13.08V18.97H29.09V17.57H15.01V7.28H49.04V17.57H34.87V18.97H50.87V21.35H34.87V22.66H54.23V25.23H47.96Q49.78 26.3 51.56 27.58Q53.34 28.87 54.48 29.88Q53.79 30.07 52.82 30.39Q51.86 30.7 50.99 31.06Q50.13 31.42 49.59 31.69Q48.89 30.95 47.73 29.99Q46.57 29.03 45.29 28.08Q44 27.12 42.82 26.44L45.98 25.23H16.54L21.13 26.68Q19.7 28.05 17.7 29.47Q15.7 30.9 13.77 31.8ZM35.8 31.55Q35.56 30.76 35.14 29.81Q34.72 28.87 34.27 27.94Q33.83 27.01 33.33 26.33L38.62 25.53Q39.11 26.16 39.66 27.08Q40.2 28 40.65 28.97Q41.09 29.94 41.34 30.76Q40.3 30.84 38.59 31.07Q36.89 31.31 35.8 31.55ZM25.38 31.69Q25.28 30.92 25.01 29.95Q24.74 28.98 24.42 28.04Q24.1 27.09 23.7 26.41L29.09 25.81Q29.53 26.46 29.93 27.39Q30.32 28.32 30.62 29.31Q30.91 30.29 31.06 31.09Q29.97 31.14 28.25 31.31Q26.52 31.47 25.38 31.69ZM20.59 11.31H29.09V9.66H20.59ZM34.87 11.31H43.31V9.66H34.87ZM20.59 15.19H29.09V13.58H20.59ZM34.87 15.19H43.31V13.58H34.87ZM14.22 58.96V39.59H25.33Q25.87 38.93 26.47 38.05Q27.06 37.18 27.58 36.33Q28.1 35.48 28.34 34.88L35.66 35.26Q35.26 35.87 34.69 36.65Q34.12 37.43 33.51 38.21Q32.89 38.98 32.35 39.59H49.98V58.96ZM20.49 56.03H43.71V50.56H20.49ZM20.49 47.69H43.71V42.51H20.49Z'

const SEAL = `<svg class="seal" viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="5"/><path class="seal-paper" d="${SEAL_CHARACTERS}"/></svg>`

const SMALL_SEAL = `<svg class="seal" viewBox="0 0 16 16" aria-hidden="true"><rect width="16" height="16" rx="1.25"/><path class="seal-paper" fill-rule="evenodd" d="M6 2h2v2H6zM3 4h10v10H3zM5 6v2h6V6zM5 10v2h6v-2z"/></svg>`

const FONT_FACES = ([
  ['Kuroshiro Display', FALLBACK_SCREEN_FONTS.display],
  ['Kuroshiro Text', FALLBACK_SCREEN_FONTS.text],
  ['Kuroshiro Mono', FALLBACK_SCREEN_FONTS.mono],
] as const).map(([family, data]) => `@font-face { font-family: "${family}"; src: url(data:font/woff;base64,${data}) format("woff"); }`).join('\n')

const SHEET_CSS = `
* { box-sizing: border-box; margin: 0; }
html, body { width: 100%; height: 100%; overflow: hidden; }
body { --ink: #000; --paper: #fff; background: var(--paper); color: var(--ink); font-family: "Kuroshiro Text", sans-serif; }
body.sleep { --ink: #fff; --paper: #000; }
.seal { display: block; flex: none; fill: var(--ink); }
.seal-paper { fill: var(--paper); }
.word { font-family: "Kuroshiro Display", sans-serif; line-height: 1; letter-spacing: -0.015em; }
.mono { font-family: "Kuroshiro Mono", monospace; }

.sheet { height: 100%; padding: calc(48 * var(--u)) calc(56 * var(--u)) calc(44 * var(--u)); display: grid; grid-template-rows: 1fr auto; }
h1 { font-family: "Kuroshiro Display", sans-serif; font-weight: normal; font-size: calc(88 * var(--u)); line-height: 0.95; letter-spacing: -0.015em; max-width: calc(700 * var(--u)); text-wrap: balance; }
h1 span { display: block; }
h1 .name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
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
.seal-only .seal { width: var(--small-seal); height: var(--small-seal); shape-rendering: crispEdges; }
`

function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[character]!)
}

interface Notice {
  /** A Screen's name: set on its own headline line and cut there, so a long name never pushes the sheet onto its footer. */
  name?: string
  headline: string
  body?: string
}

function errorNotice(request: Extract<FallbackScreenRequest, { kind: 'error' }>, facts: FallbackScreenFacts | null): Notice {
  if (request.cause === 'mirror' && facts) {
    return {
      headline: 'Mirroring failed',
      body: 'Kuroshiro could not fetch this Device’s image from TRMNL. Next try at the next poll.',
    }
  }
  const screenName = request.cause === 'render' && facts ? request.screenName : null
  return screenName
    ? {
        name: screenName,
        headline: 'could not be shown',
        body: 'Kuroshiro could not make this Screen’s image. Next try on its next turn in Rotation.',
      }
    : {
        headline: 'A Screen could not be shown',
        body: 'Kuroshiro could not make the Screen’s image. Next try on its next turn in Rotation.',
      }
}

function notice(request: Exclude<FallbackScreenRequest, { kind: 'welcome' }>, facts: FallbackScreenFacts | null): Notice {
  switch (request.kind) {
    case 'noScreen':
      return { headline: 'No Screen to show', body: 'Add a Screen to this Device, or check the Schedules of the ones it has.' }
    case 'error':
      return errorNotice(request, facts)
    case 'sleep':
      return { headline: facts?.wakeTime ? `Asleep until ${facts.wakeTime}` : 'Asleep' }
  }
}

const SIGNATURE = `<div class="signature"><span class="word">Kuroshiro</span>${SEAL}</div>`

function footer(facts: string, signature: string): string {
  return `<footer><div class="facts">${facts}</div>${signature}</footer>`
}

function welcomeSheet(facts: FallbackScreenFacts | null): string {
  const whereToAddAScreen = facts
    ? `Add its first Screen at <span class="mono">${escapeHtml(facts.instanceUrl)}</span>`
    : 'Add its first Screen in Kuroshiro.'
  return `<main class="sheet">
  <div>
    <div class="lockup">${SEAL}<span class="word">Kuroshiro</span></div>
    <p class="body">This Device is connected.<br>${whereToAddAScreen}</p>
  </div>
  ${footer(facts ? `<div class="mono">${escapeHtml(facts.friendlyId)}</div>` : '', '')}
</main>`
}

function noticeSheet(request: Exclude<FallbackScreenRequest, { kind: 'welcome' }>, facts: FallbackScreenFacts | null): string {
  const { name, headline, body } = notice(request, facts)
  return `<main class="sheet">
  <div>
    <h1>${name ? `<span class="name">${escapeHtml(name)}</span><span>${headline}</span>` : headline}</h1>
    ${body ? `<p class="body">${body}</p>` : ''}
  </div>
  ${footer(facts ? `<div>${escapeHtml(facts.deviceName)}</div><div class="mono">${escapeHtml(facts.instanceUrl)}</div>` : '', SIGNATURE)}
</main>`
}

/**
 * A self-contained document for one Fallback Screen at a Device Model's pixel
 * size: faces inlined, seal outlined, nothing fetched. Without `facts` it is
 * the static last resort, which names no Device, Instance or Screen.
 */
export function fallbackScreenHtml(request: FallbackScreenRequest, facts: FallbackScreenFacts | null, size: FallbackScreenSize): string {
  const unit = fallbackScreenUnit(size)
  const sealOnly = isSealOnly(size)
  const content = sealOnly
    ? `<main class="seal-only">${SMALL_SEAL}</main>`
    : request.kind === 'welcome' ? welcomeSheet(facts) : noticeSheet(request, facts)
  const variables = sealOnly
    ? `--small-seal: ${smallSealSide(size)}px;`
    : `--u: ${unit}px; --rule: ${Math.max(2, Math.round(4 * unit))}px;`
  return `<!doctype html>
<html lang="en" style="${variables}">
<head><meta charset="utf-8"><style>${sealOnly ? '' : FONT_FACES}${SHEET_CSS}</style></head>
<body class="${request.kind}">${content}</body>
</html>`
}
