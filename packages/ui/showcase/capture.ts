import type { Browser, Page } from 'playwright'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

const SCREENSHOTS_DIR = resolve(import.meta.dirname, '../../site/public/screenshots')

const THEMES = ['light', 'dark'] as const
const VIEWPORT = { width: 1440, height: 900 }
const DEVICE_SCALE_FACTOR = 2
const AFTER_SETTLING_MS = 400

export interface Shot {
  name: string
  /** Relative to the Instance's base URL. */
  path: string
  /** Waits until the page shows what the shot is of. */
  ready: (page: Page) => Promise<void>
}

/**
 * The page has fetched and drawn everything, including what its frames load.
 * The checks are page-side source text: this suite's own types have no DOM to write them in.
 */
async function settle(page: Page) {
  await page.waitForLoadState('networkidle')
  await page.evaluate('document.fonts.ready')
  await page.waitForFunction('[...document.images].every(image => image.complete && image.naturalWidth > 0)')
  await page.waitForFunction('document.querySelectorAll(\'[aria-busy="true"]\').length === 0')
  await page.waitForTimeout(AFTER_SETTLING_MS)
}

/** Shoots the page once per theme, each in a fresh context that prefers it, as `<name>-<theme>.png`. */
export async function capture(browser: Browser, baseUrl: string, shot: Shot) {
  mkdirSync(SCREENSHOTS_DIR, { recursive: true })
  for (const theme of THEMES) {
    const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: DEVICE_SCALE_FACTOR, colorScheme: theme, reducedMotion: 'reduce' })
    try {
      const page = await context.newPage()
      await page.goto(new URL(shot.path, baseUrl).href)
      await shot.ready(page)
      await settle(page)
      await page.screenshot({ path: resolve(SCREENSHOTS_DIR, `${shot.name}-${theme}.png`), animations: 'disabled', caret: 'hide' })
    }
    finally {
      await context.close()
    }
  }
}
