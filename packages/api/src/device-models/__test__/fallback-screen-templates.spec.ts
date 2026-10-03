import type { FallbackScreenFacts, FallbackScreenRequest } from '../fallback-screen-templates.js'
import { describe, expect, it } from 'vitest'
import { fallbackScreenHtml } from '../fallback-screen-templates.js'

const OG = { width: 800, height: 480 }
const TIDBYT = { width: 64, height: 32 }
const FACTS: FallbackScreenFacts = { deviceName: 'Kitchen', friendlyId: '4F2A1C', instanceUrl: 'http://kuroshiro.local', wakeTime: '07:00' }

/** The sheet's words as a reader meets them, without the inlined faces and styles. */
function printedText(html: string): string {
  return html
    .replace(/<style>[\s\S]*<\/style>/, '')
    .replace(/<svg[\s\S]*?<\/svg>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const sheet = (request: FallbackScreenRequest, facts: FallbackScreenFacts | null = FACTS) => printedText(fallbackScreenHtml(request, facts, OG))

describe('fallbackScreenHtml', () => {
  describe('the four sheets', () => {
    it('welcome leads with the wordmark, points at the Instance and ends with the friendly id', () => {
      expect(sheet({ kind: 'welcome' })).toBe('Kuroshiro This Device is connected. Add its first Screen at http://kuroshiro.local 4F2A1C')
    })

    it('no-screen says what to do and signs with the Device, the Instance and the wordmark', () => {
      expect(sheet({ kind: 'noScreen' })).toBe('No Screen to show Add a Screen to this Device, or check the Schedules of the ones it has. Kitchen http://kuroshiro.local Kuroshiro')
    })

    it('sleep reads only the wake time, on the inverted sheet', () => {
      const html = fallbackScreenHtml({ kind: 'sleep' }, FACTS, OG)

      expect(printedText(html)).toBe('Asleep until 07:00 Kitchen http://kuroshiro.local Kuroshiro')
      expect(html).toContain('<body class="sleep">')
    })

    it('escapes the Device\'s facts', () => {
      const html = fallbackScreenHtml({ kind: 'noScreen' }, { ...FACTS, deviceName: '<b>Kitchen</b> & "Hall"' }, OG)

      expect(html).toContain('&lt;b&gt;Kitchen&lt;/b&gt; &amp; &quot;Hall&quot;')
    })
  })

  describe('the error wordings', () => {
    it('a failed mirror fetch reads "Mirroring failed" and the next poll', () => {
      expect(sheet({ kind: 'error', cause: 'mirror' })).toBe('Mirroring failed Kuroshiro could not fetch this Device’s image from TRMNL. Next try at the next poll. Kitchen http://kuroshiro.local Kuroshiro')
    })

    it('a failed render names the Screen on its own headline line, then "could not be shown"', () => {
      const html = fallbackScreenHtml({ kind: 'error', cause: 'render', screenName: 'Weather' }, FACTS, OG)

      expect(html).toContain('<h1><span class="name">Weather</span><span>could not be shown</span></h1>')
      expect(printedText(html)).toBe('Weather could not be shown Kuroshiro could not make this Screen’s image. Next try on its next turn in Rotation. Kitchen http://kuroshiro.local Kuroshiro')
    })

    it('a failed render of a Screen without a name reads "A Screen could not be shown"', () => {
      expect(sheet({ kind: 'error', cause: 'render', screenName: null })).toBe('A Screen could not be shown Kuroshiro could not make the Screen’s image. Next try on its next turn in Rotation. Kitchen http://kuroshiro.local Kuroshiro')
    })

    it('escapes the Screen\'s name', () => {
      expect(fallbackScreenHtml({ kind: 'error', cause: 'render', screenName: '<script>' }, FACTS, OG)).toContain('<span class="name">&lt;script&gt;</span>')
    })
  })

  describe('the static last resort, drawn without facts', () => {
    it('error names no Screen and leaves the footer to the signature', () => {
      expect(sheet({ kind: 'error', cause: 'render', screenName: 'Weather' }, null)).toBe('A Screen could not be shown Kuroshiro could not make the Screen’s image. Next try on its next turn in Rotation. Kuroshiro')
    })

    it('has no mirror wording of its own', () => {
      expect(sheet({ kind: 'error', cause: 'mirror' }, null)).toMatch(/^A Screen could not be shown/)
    })

    it('no-screen, sleep and welcome print no Device, Instance or wake time', () => {
      expect(sheet({ kind: 'noScreen' }, null)).toBe('No Screen to show Add a Screen to this Device, or check the Schedules of the ones it has. Kuroshiro')
      expect(sheet({ kind: 'sleep' }, null)).toBe('Asleep Kuroshiro')
      expect(sheet({ kind: 'welcome' }, null)).toBe('Kuroshiro This Device is connected. Add its first Screen in Kuroshiro.')
    })
  })

  describe('the scale unit', () => {
    it.each([
      ['a TRMNL OG is the reference', { width: 800, height: 480 }, '1px', '4px'],
      ['a narrower panel is held by its width', { width: 648, height: 480 }, '0.81px', '3px'],
      ['a portrait panel is held by its width', { width: 1404, height: 1872 }, '1.755px', '7px'],
      ['the largest panel is held by its width', { width: 2880, height: 2160 }, '3.6px', '14px'],
      ['a wide panel is held by its height', { width: 1600, height: 480 }, '1px', '4px'],
      ['the rule never thins below 2 px', { width: 320, height: 240 }, '0.4px', '2px'],
    ])('%s', (_, size, unit, rule) => {
      expect(fallbackScreenHtml({ kind: 'noScreen' }, FACTS, size)).toContain(`style="--u: ${unit}; --rule: ${rule};"`)
    })
  })

  describe('the seal-only tier', () => {
    it.each<FallbackScreenRequest>([
      { kind: 'welcome' },
      { kind: 'noScreen' },
      { kind: 'sleep' },
      { kind: 'error', cause: 'mirror' },
      { kind: 'error', cause: 'render', screenName: 'Weather' },
    ])('draws nothing but the small seal on a Tidbyt for %o', (request) => {
      const html = fallbackScreenHtml(request, FACTS, TIDBYT)

      expect(printedText(html)).toBe('')
      expect(html).toContain('<main class="seal-only"><svg class="seal" viewBox="0 0 16 16"')
    })

    it('sizes the seal in whole multiples of its 16 px grid', () => {
      expect(fallbackScreenHtml({ kind: 'noScreen' }, FACTS, TIDBYT)).toContain('--small-seal: 16px;')
      expect(fallbackScreenHtml({ kind: 'noScreen' }, FACTS, { width: 240, height: 135 })).toContain('--small-seal: 96px;')
    })

    it('starts below a short side of 200 px', () => {
      expect(printedText(fallbackScreenHtml({ kind: 'noScreen' }, FACTS, { width: 400, height: 199 }))).toBe('')
      expect(printedText(fallbackScreenHtml({ kind: 'noScreen' }, FACTS, { width: 400, height: 200 }))).toContain('No Screen to show')
    })

    it('carries no faces, since it prints no text', () => {
      expect(fallbackScreenHtml({ kind: 'noScreen' }, FACTS, TIDBYT)).not.toContain('@font-face')
    })
  })

  it('references nothing outside the document', () => {
    const html = fallbackScreenHtml({ kind: 'error', cause: 'render', screenName: 'Weather' }, FACTS, OG)

    expect(html).not.toMatch(/https?:\/\/(?!kuroshiro\.local)/)
    expect(html).not.toMatch(/<link|<script|<img|@import/)
  })
})
