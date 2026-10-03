import type { Locator } from 'vitest/browser'
import type { ViewportName } from './viewport'
import { expect } from 'vitest'
import { page } from 'vitest/browser'
import { forceTheme, THEMES } from './theme'
import { resetViewport, resizeTo, VIEWPORTS } from './viewport'

/**
 * Compares one element with its committed baseline `<name>-chromium-linux.png`, once the
 * faces it uses have loaded. Only `*.shots.ts` files call this: they run inside the pinned
 * Playwright image and nowhere else.
 */
export async function expectScreenshot(target: Locator, name: string) {
  const { innerWidth: width, innerHeight: height } = window
  await document.fonts.ready
  // A shot is clipped to the viewport, so the viewport grows to hold the whole document first.
  await resizeTo(width, Math.max(height, document.documentElement.scrollHeight))
  try {
    await expect.element(target).toMatchScreenshot(name)
  }
  finally {
    await resizeTo(width, height)
  }
}

const VIEWPORT_NAMES = Object.keys(VIEWPORTS) as ViewportName[]

/** Takes the four shots of the mounted page: phone and desktop width, each in light and dark. */
export async function expectPageScreenshots(name: string) {
  for (const viewport of VIEWPORT_NAMES) {
    await resizeTo(VIEWPORTS[viewport].width, VIEWPORTS[viewport].height)
    for (const theme of THEMES) {
      await forceTheme(theme)
      await expectScreenshot(page.elementLocator(document.body), `${name}-${viewport}-${theme}`)
    }
  }
  await forceTheme('light')
  await resetViewport()
}
