import type { PluginDetail } from 'kuroshiro-shared'
import { delay, http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { expectAccessible } from '@/testing/a11y'
import { api, apiUrl } from '@/testing/api/server'
import { buildPluginDetail } from '@/testing/fixtures/plugins'
import { expectNoHorizontalOverflow } from '@/testing/overflow'
import { fakePlugin, mountPlugin } from './pluginPageHarness'

const RECIPE: NonNullable<PluginDetail['recipe']> = { id: '41120', name: 'Weather', importedAt: '2026-09-12T08:00:00.000Z', snapshotTakenAt: '2026-09-12T08:00:00.000Z' }

const fromRecipe = (recipe: Partial<NonNullable<PluginDetail['recipe']>> = {}) => buildPluginDetail({ id: 'weather', name: 'Weather', recipe: { ...RECIPE, ...recipe } })

const section = () => document.querySelector<HTMLElement>('#recipe')

const sentence = () => section()?.querySelector('p')?.textContent?.replace(/\s+/g, ' ').trim()

describe('the Recipe of a Plugin', () => {
  it('is not there for a Plugin that was not imported from a Recipe', async () => {
    fakePlugin(buildPluginDetail({ id: 'weather', name: 'Weather', recipe: null }))
    const screen = await mountPlugin()

    await expect.element(screen.getByRole('heading', { name: 'Devices', level: 2 })).toBeVisible()
    expect(section()).toBeNull()
    expect(screen.getByRole('link', { name: 'Run a Recipe Update Check' }).elements()).toEqual([])
  })

  it('names the Recipe with a link to its page on trmnl.com and the day it was imported, with the check on its heading line', async () => {
    fakePlugin(fromRecipe())
    const screen = await mountPlugin()

    await expect.element(screen.getByRole('heading', { name: 'Recipe', level: 2 })).toBeVisible()
    expect(sentence()).toBe('Imported from the Recipe Weather 41120 on trmnl.com, on 12 September 2026. Nothing updates by itself: a Recipe Update Check downloads the Recipe again and shows what changed before anything is applied.')
    await expect.element(screen.getByRole('link', { name: 'Weather 41120' })).toHaveAttribute('href', 'https://trmnl.com/recipes/41120')
    await expect.element(screen.getByRole('link', { name: 'Run a Recipe Update Check' })).toHaveAttribute('href', '/plugins/weather/update')
  })

  it('dates the Recipe Snapshot once a check has been applied or skipped', async () => {
    fakePlugin(fromRecipe({ snapshotTakenAt: '2026-10-01T09:00:00.000Z' }))
    await mountPlugin()

    await expect.poll(sentence).toMatch(/^Imported from the Recipe Weather 41120 on trmnl\.com, last taken over on 1 October 2026\. /)
  })

  it('names the Recipe by its id alone when the Plugin does not know its name', async () => {
    fakePlugin(fromRecipe({ name: null, snapshotTakenAt: null }))
    const screen = await mountPlugin()

    await expect.poll(sentence).toMatch(/^Imported from the Recipe 41120 on trmnl\.com, on 12 September 2026\. /)
    await expect.element(screen.getByRole('link', { name: '41120', exact: true })).toHaveAttribute('href', 'https://trmnl.com/recipes/41120')
  })

  it('asks about unsaved changes before the check opens', async () => {
    fakePlugin(fromRecipe())
    api.use(http.get(apiUrl('plugins/weather/recipe-update'), async () => {
      await delay('infinite')
      return HttpResponse.json({})
    }))
    const screen = await mountPlugin()

    await screen.getByRole('button', { name: 'Name and description' }).click()
    await screen.getByRole('textbox', { name: 'Name' }).fill('Forecast')
    await screen.getByRole('link', { name: 'Run a Recipe Update Check' }).click()

    const question = screen.getByRole('alertdialog', { name: 'Leave without saving?' })
    await expect.element(question).toBeVisible()
    await question.getByRole('button', { name: 'Leave' }).click()

    await expect.element(screen.getByRole('heading', { name: 'Recipe Update Check', level: 2 })).toBeVisible()
    expect(screen.router.currentRoute.value.path).toBe('/plugins/weather/update')
  })

  it('is accessible and does not overflow', async () => {
    fakePlugin(fromRecipe())
    const screen = await mountPlugin()
    await expect.element(screen.getByRole('heading', { name: 'Recipe', level: 2 })).toBeVisible()

    await expectAccessible()
    await expectNoHorizontalOverflow()
  })
})
