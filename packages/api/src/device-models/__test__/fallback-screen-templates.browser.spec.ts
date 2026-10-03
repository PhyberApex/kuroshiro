import type { Browser, Page } from 'puppeteer'
import type { FallbackScreenFacts, FallbackScreenRequest, FallbackScreenSize } from '../fallback-screen-templates.js'
import puppeteer from 'puppeteer'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { fallbackScreenHtml } from '../fallback-screen-templates.js'

const FACTS: FallbackScreenFacts = { deviceName: 'Kitchen', friendlyId: '4F2A1C', instanceUrl: 'http://kuroshiro.local', wakeTime: '07:00' }
const SIXTY_CHARACTER_NAME = 'Weather for the whole week at the cabin by the northern lake'.padEnd(60, '!')

const SIZES: FallbackScreenSize[] = [
  { width: 800, height: 480 },
  { width: 648, height: 480 },
  { width: 1404, height: 1872 },
  { width: 2880, height: 2160 },
  { width: 64, height: 32 },
]

const isSealOnly = ({ width, height }: FallbackScreenSize) => Math.min(width, height) < 200

const REQUESTS: Array<[string, FallbackScreenRequest]> = [
  ['welcome', { kind: 'welcome' }],
  ['no-screen', { kind: 'noScreen' }],
  ['sleep', { kind: 'sleep' }],
  ['error, mirror wording', { kind: 'error', cause: 'mirror' }],
  ['error, render wording', { kind: 'error', cause: 'render', screenName: 'Weather' }],
  ['error, render wording with a 60-character name', { kind: 'error', cause: 'render', screenName: SIXTY_CHARACTER_NAME }],
]

interface Layout {
  text: string
  seals: number
  documentOverflows: boolean
  /** Elements whose box leaves the panel. */
  outsidePanel: string[]
  /** Whether the sheet's upper block ends above its footer. */
  clearOfFooter: boolean
  facesLoaded: boolean
  name: { lines: number, cut: boolean } | null
  headlineLines: number | null
}

describe('fallback screens in a browser', () => {
  let browser: Browser
  let page: Page
  let requested: string[]

  beforeAll(async () => {
    browser = await puppeteer.launch({ args: ['--no-sandbox'] })
    page = await browser.newPage()
    await page.setRequestInterception(true)
    page.on('request', (request) => {
      requested.push(request.url())
      void request.continue()
    })
  })

  afterAll(async () => {
    await browser?.close()
  })

  async function layOut(request: FallbackScreenRequest, size: FallbackScreenSize): Promise<Layout> {
    requested = []
    await page.setViewport(size)
    await page.setContent(fallbackScreenHtml(request, FACTS, size), { waitUntil: 'load' })
    return page.evaluate(async () => {
      await document.fonts.ready
      const panel = { width: window.innerWidth, height: window.innerHeight }
      const root = document.documentElement
      const lineCount = (element: Element) => Math.round(element.getBoundingClientRect().height / Number.parseFloat(getComputedStyle(element).lineHeight))
      const upperBlock = document.querySelector('.sheet > div')
      const name = document.querySelector('h1 .name')
      const headline = document.querySelector('h1')
      return {
        text: document.body.textContent!.trim(),
        seals: document.querySelectorAll('svg.seal').length,
        documentOverflows: root.scrollWidth > panel.width || root.scrollHeight > panel.height,
        outsidePanel: Array.from(document.querySelectorAll('body *'))
          .filter((element) => {
            const box = element.getBoundingClientRect()
            return box.left < 0 || box.top < 0 || box.right > panel.width + 0.5 || box.bottom > panel.height + 0.5
          })
          .map(element => element.tagName),
        clearOfFooter: !upperBlock || upperBlock.scrollHeight <= upperBlock.clientHeight,
        facesLoaded: Array.from(document.fonts).every(face => face.status === 'loaded'),
        name: name ? { lines: lineCount(name), cut: name.scrollWidth > name.clientWidth } : null,
        headlineLines: headline ? lineCount(headline) : null,
      }
    })
  }

  describe.each(SIZES)('at $width×$height', (size) => {
    const sealOnly = isSealOnly(size)

    it.each(REQUESTS)('%s fits the panel and fetches nothing', async (_, request) => {
      const layout = await layOut(request, size)

      expect(requested.filter(url => !url.startsWith('data:'))).toEqual([])
      expect(layout.documentOverflows).toBe(false)
      expect(layout.outsidePanel).toEqual([])
      expect(layout.clearOfFooter).toBe(true)
      expect(layout.facesLoaded).toBe(true)
      expect(layout.seals).toBe(1)
      if (sealOnly)
        expect(layout.text).toBe('')
      else
        expect(layout.text).not.toBe('')
    })
  })

  it.each(SIZES.filter(size => !isSealOnly(size)))('keeps a 60-character Screen name on one line with an ellipsis at $width×$height', async (size) => {
    const layout = await layOut({ kind: 'error', cause: 'render', screenName: SIXTY_CHARACTER_NAME }, size)

    expect(layout.name).toEqual({ lines: 1, cut: true })
    expect(layout.headlineLines).toBe(2)
  })

  it('leaves a short Screen name whole', async () => {
    const layout = await layOut({ kind: 'error', cause: 'render', screenName: 'Weather' }, { width: 800, height: 480 })

    expect(layout.name).toEqual({ lines: 1, cut: false })
  })
})
