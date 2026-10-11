import type { Browser, BrowserContext, Locator, Page } from 'playwright'
import { chromium } from 'playwright'
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest'
import { layerOrderProblem } from '../scripts/cssLayers.ts'

const baseUrl = inject('baseUrl')
const THEMES = ['light', 'dark'] as const
const VIEWPORT = { width: 1280, height: 900 }

function styleOf(locator: Locator, cssProperty: string) {
  return locator.evaluate((element, cssProperty) => getComputedStyle(element).getPropertyValue(cssProperty), cssProperty)
}

/**
 * Resolves a token the way an element on the page would see it: a probe element takes the token as its own
 * value, so `light-dark()` follows the page's colour scheme, not this test's.
 */
function tokenAsSeenBy(page: Page, token: string, cssProperty: string) {
  return page.evaluate(([token, cssProperty]) => {
    const probe = document.body.appendChild(document.createElement('span'))
    probe.style.setProperty(cssProperty, `var(${token})`)
    const value = getComputedStyle(probe).getPropertyValue(cssProperty)
    probe.remove()
    return value
  }, [token, cssProperty] as const)
}

describe('the built UI renders components the way their styles define', () => {
  let browser: Browser

  beforeAll(async () => {
    browser = await chromium.launch()
  })

  afterAll(() => browser.close())

  it('declares the cascade layer order before its first stylesheet, as the build guards', async () => {
    const page = await browser.newPage()
    await page.goto(new URL('plugins/new', baseUrl).href)
    const html = await page.content()
    await page.close()

    expect(layerOrderProblem(html)).toBeNull()
  })

  describe.each(THEMES)('in %s', (theme) => {
    let context: BrowserContext
    let pluginsNew: Page
    let instanceSettings: Page
    const failures: string[] = []

    beforeAll(async () => {
      context = await browser.newContext({ viewport: VIEWPORT, colorScheme: theme })

      const opened = async (path: string) => {
        const page = await context.newPage()
        page.on('pageerror', error => failures.push(error.message))
        page.on('requestfailed', request => failures.push(`${request.method()} ${request.url()}`))
        await page.goto(new URL(path, baseUrl).href)
        return page
      }

      pluginsNew = await opened('plugins/new')
      await pluginsNew.getByRole('button', { name: 'Import Recipe' }).waitFor()

      instanceSettings = await opened('instance/settings')
      await instanceSettings.getByRole('heading', { name: 'Instance Settings', level: 2 }).waitFor()
    })

    afterAll(() => context.close())

    it('loads with no failed stylesheet or script request', () => {
      expect(failures).toEqual([])
    })

    it('fills a primary Button with ink and sets its label in paper', async () => {
      const button = pluginsNew.getByRole('button', { name: 'Import Recipe' })

      expect(await styleOf(button, 'background-color')).toBe(await tokenAsSeenBy(pluginsNew, '--color-ink', 'background-color'))
      expect(await styleOf(button, 'color')).toBe(await tokenAsSeenBy(pluginsNew, '--color-paper', 'color'))
    })

    it('keeps the quiet back link, to All Plugins, in the soft ink', async () => {
      const backLink = pluginsNew.getByRole('link', { name: 'All Plugins' })

      expect(await styleOf(backLink, 'color')).toBe(await tokenAsSeenBy(pluginsNew, '--color-ink-soft', 'color'))
    })

    it('separates the segments of the Appearance switch with a border, not one run of text', async () => {
      const light = instanceSettings.getByRole('radio', { name: 'Light' })

      expect(await styleOf(light, 'border-left-width')).toBe('1px')
      expect(await styleOf(light, 'border-left-color')).toBe(await tokenAsSeenBy(instanceSettings, '--color-ink', 'border-left-color'))
    })

    it('marks the checked Appearance segment with ink and paper', async () => {
      const system = instanceSettings.getByRole('radio', { name: 'System' })

      expect(await styleOf(system, 'background-color')).toBe(await tokenAsSeenBy(instanceSettings, '--color-ink', 'background-color'))
      expect(await styleOf(system, 'color')).toBe(await tokenAsSeenBy(instanceSettings, '--color-paper', 'color'))
    })

    it('rules between Radio Rows in the line colour', async () => {
      const recipe = pluginsNew.getByRole('radio', { name: 'Recipe', exact: true })

      expect(await styleOf(recipe, 'border-bottom-width')).toBe('1px')
      expect(await styleOf(recipe, 'border-bottom-color')).toBe(await tokenAsSeenBy(pluginsNew, '--color-line', 'border-bottom-color'))
    })

    it('marks the Instance page list\'s current item with ink and paper', async () => {
      const current = instanceSettings.getByRole('navigation', { name: 'Instance' }).locator('[aria-current="page"]')

      expect(await styleOf(current, 'background-color')).toBe(await tokenAsSeenBy(instanceSettings, '--color-ink', 'background-color'))
      expect(await styleOf(current, 'color')).toBe(await tokenAsSeenBy(instanceSettings, '--color-paper', 'color'))
    })

    it('borders the Recipe field control in the soft ink', async () => {
      const control = pluginsNew.getByRole('textbox', { name: 'Recipe' })

      expect(await styleOf(control, 'border-top-width')).toBe('1px')
      expect(await styleOf(control, 'border-top-color')).toBe(await tokenAsSeenBy(pluginsNew, '--color-ink-soft', 'border-top-color'))
    })
  })
})
