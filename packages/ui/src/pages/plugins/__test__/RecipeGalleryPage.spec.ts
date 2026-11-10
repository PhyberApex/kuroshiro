import type { RecipeSummary } from 'kuroshiro-shared'
import { delay, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { expectAccessible } from '@/testing/a11y'
import { mountApp } from '@/testing/app'
import { buildPluginSummary, buildRecipeSummary } from '@/testing/fixtures/plugins'
import { TRMNL_IMAGE_BUCKET } from '@/testing/images'
import { expectNoHorizontalOverflow } from '@/testing/overflow'
import { answerPage, fakeGallery, IMPORTED, MOON_PHASE, mountGallery, pageOf, RECIPES, refuseWith } from './recipeGalleryHarness'

type Mounted = Awaited<ReturnType<typeof mountGallery>>

const card = (screen: Mounted, name: string) => screen.getByRole('listitem', { name, exact: true })
const searchField = (screen: Mounted) => screen.getByRole('searchbox', { name: 'Search Recipes' })
const select = (screen: Mounted, name: 'Category' | 'Order') => screen.getByRole('combobox', { name })
const address = (screen: Mounted) => screen.router.currentRoute.value.fullPath
const counted = (screen: Mounted) => screen.getByRole('status').filter({ hasText: /^Showing/ })
const pluginPageOpened = (screen: Mounted) => expect.element(screen.getByRole('heading', { name: IMPORTED.plugin.name, level: 1 })).toBeVisible()

async function choose(screen: Mounted, name: 'Category' | 'Order', option: string) {
  await select(screen, name).click()
  await screen.getByRole('option', { name: option, exact: true }).click()
}

function numbered(from: number, count: number): RecipeSummary[] {
  return Array.from({ length: count }, (_, index) => buildRecipeSummary({
    id: String(from + index),
    name: `Recipe ${from + index}`,
    screenshotUrl: `${TRMNL_IMAGE_BUCKET}/${from + index}`,
  }))
}

describe('the Recipe Gallery', () => {
  it('opens from "Import a Recipe" on the Plugins list', async () => {
    fakeGallery({ plugins: [buildPluginSummary()] })
    const screen = await mountApp({ at: '/plugins' })

    await screen.getByRole('link', { name: 'Import a Recipe' }).click()

    await expect.element(screen.getByRole('heading', { name: 'Recipes', level: 1 })).toBeVisible()
    expect(address(screen)).toBe('/plugins/recipes')
  })

  it('says what it is, and leads back to the Plugins', async () => {
    fakeGallery()
    const screen = await mountGallery()

    await expect.element(screen.getByText('Ready-made Plugins published on trmnl.com. Importing one copies it into Kuroshiro; nothing updates by itself afterwards.')).toBeVisible()
    await expect.element(screen.getByRole('link', { name: 'All Plugins' })).toHaveAttribute('href', '/plugins')
  })

  it('shows each Recipe as a card with its screenshot, name, description, installs and two controls that name it', async () => {
    const faked = fakeGallery()
    const screen = await mountGallery()

    await expect.element(counted(screen)).toHaveTextContent('Showing 4 of 4 Recipes, most installed first')
    expect(faked.asked.at(-1)).toEqual({ sort: 'install' })
    const moon = card(screen, 'Moon Phase')
    await expect.element(moon.getByRole('img', { name: 'Screenshot of Moon Phase' })).toHaveAttribute('src', MOON_PHASE.screenshotUrl)
    await expect.element(moon.getByRole('img', { name: 'Screenshot of Moon Phase' })).toHaveAttribute('loading', 'lazy')
    await expect.element(moon.getByRole('img', { name: 'Screenshot of Moon Phase' })).toHaveAttribute('referrerpolicy', 'no-referrer')
    await expect.element(moon.getByText('Tonight\'s phase of the Moon, with moonrise and moonset')).toBeVisible()
    await expect.element(moon.getByText('2,140 installs')).toBeVisible()
    await expect.element(moon.getByRole('button', { name: 'Import Moon Phase' })).toBeVisible()
    const out = moon.getByRole('link', { name: 'Moon Phase on trmnl.com' })
    await expect.element(out).toHaveAttribute('href', 'https://trmnl.com/recipes/moon-phase-41120')
    await expect.element(out).toHaveAttribute('target', '_blank')
    await expect.element(out).toHaveTextContent('On trmnl.com')
    await expect.element(screen.getByText('That is the whole catalog.')).toBeVisible()
  })

  it('keeps the plate\'s empty look for a Recipe without a screenshot, or one that cannot be loaded', async () => {
    fakeGallery({ recipes: answerPage(pageOf([
      buildRecipeSummary({ id: '1', name: 'No picture', screenshotUrl: null }),
      buildRecipeSummary({ id: '2', name: 'Lost picture', screenshotUrl: 'https://trmnl-public.invalid/gone' }),
    ])) })
    const screen = await mountGallery()

    await expect.element(card(screen, 'No picture').getByRole('group', { name: 'Screenshot of No picture' })).toBeVisible()
    await expect.element(card(screen, 'No picture').getByRole('img')).not.toBeInTheDocument()
    await expect.element(card(screen, 'Lost picture').getByRole('img')).not.toBeInTheDocument()
    await expect.element(card(screen, 'Lost picture').getByRole('button', { name: 'Import Lost picture' })).toBeVisible()
  })

  describe('searching', () => {
    it('searches on TRMNL\'s side once typing stops, keeps the search in the address and counts what matches', async () => {
      const faked = fakeGallery({ recipes: query => HttpResponse.json(query.get('search') === 'weather' ? pageOf([RECIPES[2]!], { total: 1 }) : pageOf(RECIPES)) })
      const screen = await mountGallery()
      await expect.element(counted(screen)).toHaveTextContent('Showing 4 of 4 Recipes, most installed first')

      await searchField(screen).fill('weather')

      await expect.element(counted(screen)).toHaveTextContent('Showing 1 of 1 Recipe that matches, most installed first')
      expect(address(screen)).toBe('/plugins/recipes?q=weather')
      expect(faked.asked.at(-1)).toEqual({ search: 'weather', sort: 'install' })
      await expect.element(screen.getByText('That is every Recipe that matches.')).toBeVisible()
    })

    it('says a search needs three characters, and leaves the grid as it is', async () => {
      const faked = fakeGallery()
      const screen = await mountGallery()
      await expect.element(counted(screen)).toBeVisible()
      const asked = faked.asked.length

      await searchField(screen).fill('we')

      await expect.element(searchField(screen)).toHaveAccessibleDescription('A search needs three characters.')
      await new Promise(resolve => setTimeout(resolve, 400))
      expect(faked.asked).toHaveLength(asked)
      expect(address(screen)).toBe('/plugins/recipes')
      await expect.element(card(screen, 'Moon Phase')).toBeVisible()
    })

    it('opens with the search, the category and the order the address holds', async () => {
      const faked = fakeGallery()
      const screen = await mountGallery('/plugins/recipes?q=weather&category=calendar&sort=newest')

      await expect.element(searchField(screen)).toHaveValue('weather')
      await expect.element(select(screen, 'Category')).toHaveTextContent('Calendar')
      await expect.element(select(screen, 'Order')).toHaveTextContent('Newest')
      await expect.element(counted(screen)).toHaveTextContent('Showing 4 of 4 Recipes that match, newest first')
      expect(faked.asked.at(-1)).toEqual({ search: 'weather', category: 'calendar', sort: 'newest' })
    })
  })

  describe('the category', () => {
    it('offers every category and TRMNL\'s categories, capitalised, and asks for the one chosen', async () => {
      const faked = fakeGallery()
      const screen = await mountGallery()
      await expect.element(select(screen, 'Category')).toHaveTextContent('Every category')

      await select(screen, 'Category').click()
      expect(screen.getByRole('option').elements().map(option => option.textContent?.trim())).toEqual(['Every category', 'Album', 'Calendar', 'Weather'])
      await screen.getByRole('option', { name: 'Calendar', exact: true }).click()

      await expect.poll(() => address(screen)).toBe('/plugins/recipes?category=calendar')
      await expect.poll(() => faked.asked.at(-1)).toEqual({ category: 'calendar', sort: 'install' })
      await expect.element(counted(screen)).toHaveTextContent('Showing 4 of 4 Recipes that match, most installed first')
    })

    it('combines with a search', async () => {
      const faked = fakeGallery()
      const screen = await mountGallery('/plugins/recipes?q=google')

      await choose(screen, 'Category', 'Calendar')

      await expect.poll(() => faked.asked.at(-1)).toEqual({ search: 'google', category: 'calendar', sort: 'install' })
      expect(address(screen)).toBe('/plugins/recipes?q=google&category=calendar')
    })

    it('is left out when TRMNL\'s categories cannot be read, and search and order still work', async () => {
      fakeGallery({ categories: () => HttpResponse.json([]) })
      const screen = await mountGallery()

      await expect.element(counted(screen)).toBeVisible()
      await expect.element(select(screen, 'Category')).not.toBeInTheDocument()
      await expect.element(select(screen, 'Order')).toBeVisible()
    })
  })

  describe('the order', () => {
    it.each([
      ['Most popular', 'popularity', 'most popular first'],
      ['Newest', 'newest', 'newest first'],
      ['Oldest', 'oldest', 'oldest first'],
    ])('orders by %s', async (option, sort, words) => {
      const faked = fakeGallery()
      const screen = await mountGallery()
      await expect.element(counted(screen)).toBeVisible()

      await choose(screen, 'Order', option)

      await expect.poll(() => faked.asked.at(-1)).toEqual({ sort })
      expect(address(screen)).toBe(`/plugins/recipes?sort=${sort}`)
      await expect.element(counted(screen)).toHaveTextContent(`Showing 4 of 4 Recipes, ${words}`)
    })

    it('offers the four orders, most installed first, and takes most installed out of the address', async () => {
      const faked = fakeGallery()
      const screen = await mountGallery('/plugins/recipes?sort=oldest')

      await select(screen, 'Order').click()
      expect(screen.getByRole('option').elements().map(option => option.textContent?.trim())).toEqual(['Most installed', 'Most popular', 'Newest', 'Oldest'])
      await screen.getByRole('option', { name: 'Most installed', exact: true }).click()

      await expect.poll(() => address(screen)).toBe('/plugins/recipes')
      await expect.poll(() => faked.asked.at(-1)).toEqual({ sort: 'install' })
    })
  })

  describe('paging', () => {
    const FIRST = numbered(1, 25)
    const SECOND = numbered(26, 5)
    const paged = () => fakeGallery({ recipes: query => HttpResponse.json(query.get('page') === '2'
      ? pageOf(SECOND, { page: 2, total: 30, hasMore: false })
      : pageOf(FIRST, { total: 30, hasMore: true })) })

    it('appends the next 25 below, moves the focus to the first of them and says when that was the whole catalog', async () => {
      const faked = paged()
      const screen = await mountGallery()
      await expect.element(counted(screen)).toHaveTextContent('Showing 25 of 30 Recipes, most installed first')

      await screen.getByRole('button', { name: 'More Recipes' }).click()

      await expect.element(counted(screen)).toHaveTextContent('Showing 30 of 30 Recipes, most installed first')
      expect(faked.asked.at(-1)).toEqual({ sort: 'install', page: '2' })
      await expect.element(card(screen, 'Recipe 1')).toBeVisible()
      await expect.element(screen.getByRole('heading', { name: 'Recipe 26' })).toHaveFocus()
      await expect.element(screen.getByText('That is the whole catalog.')).toBeVisible()
      await expect.element(screen.getByRole('button', { name: 'More Recipes' })).not.toBeInTheDocument()
    })

    it('shows the loading mark while it appends, and keeps the cards it has', async () => {
      fakeGallery({ recipes: async (query) => {
        if (query.get('page') === '2')
          await delay('infinite')
        return HttpResponse.json(pageOf(FIRST, { total: 30, hasMore: true }))
      } })
      const screen = await mountGallery()

      await screen.getByRole('button', { name: 'More Recipes' }).click()

      await expect.element(screen.getByRole('button', { name: 'More Recipes' })).toHaveAttribute('aria-busy', 'true')
      await expect.element(card(screen, 'Recipe 25')).toBeVisible()
    })

    it('starts again at the first page when the order changes', async () => {
      const faked = paged()
      const screen = await mountGallery()
      await screen.getByRole('button', { name: 'More Recipes' }).click()
      await expect.element(counted(screen)).toHaveTextContent('Showing 30 of 30 Recipes, most installed first')

      await choose(screen, 'Order', 'Newest')

      await expect.element(counted(screen)).toHaveTextContent('Showing 25 of 30 Recipes, newest first')
      expect(faked.asked.at(-1)).toEqual({ sort: 'newest' })
    })

    it('keeps the cards under a notice when the next page fails, and loads it on "Try again"', async () => {
      const faked = fakeGallery({ recipes: query => query.get('page') === '2'
        ? refuseWith({ statusCode: 503, code: 'upstream-busy' })()
        : HttpResponse.json(pageOf(FIRST, { total: 30, hasMore: true })) })
      const screen = await mountGallery()

      await screen.getByRole('button', { name: 'More Recipes' }).click()

      await expect.element(screen.getByRole('alert')).toHaveTextContent('trmnl.com is busy with other requests. Wait a minute and try again.')
      await expect.element(card(screen, 'Recipe 25')).toBeVisible()

      faked.recipes = query => HttpResponse.json(query.get('page') === '2' ? pageOf(SECOND, { page: 2, total: 30 }) : pageOf(FIRST, { total: 30, hasMore: true }))
      await screen.getByRole('button', { name: 'Try again' }).click()

      await expect.element(counted(screen)).toHaveTextContent('Showing 30 of 30 Recipes, most installed first')
      await expect.element(screen.getByRole('alert')).not.toBeInTheDocument()
    })
  })

  describe('importing', () => {
    it('imports the Recipe by its id and opens the Plugin\'s page', async () => {
      const faked = fakeGallery()
      const screen = await mountGallery()

      await card(screen, 'Moon Phase').getByRole('button', { name: 'Import Moon Phase' }).click()

      await pluginPageOpened(screen)
      expect(faked.sent).toEqual([{ recipe: '41120' }])
      await expect.element(screen.getByText('Imported from the Recipe Moon Phase. It is not on a Device yet.')).toBeVisible()
    })

    it('shows the loading mark on the button while the Recipe is imported', async () => {
      fakeGallery({ imported: async () => {
        await delay(300)
        return HttpResponse.json(IMPORTED, { status: 201 })
      } })
      const screen = await mountGallery()

      await screen.getByRole('button', { name: 'Import Moon Phase' }).click()

      await expect.element(screen.getByRole('button', { name: 'Import Moon Phase' })).toHaveAttribute('aria-busy', 'true')
      await pluginPageOpened(screen)
    })

    it('says which Plugin already came from a Recipe, and still imports it', async () => {
      const faked = fakeGallery({ plugins: [buildPluginSummary({ id: 'tonight', name: 'Tonight', sourceRecipeId: '41120' })] })
      const screen = await mountGallery()

      const moon = card(screen, 'Moon Phase')
      await expect.element(moon.getByText('You already have Tonight from this Recipe.')).toBeVisible()
      await expect.element(moon.getByRole('link', { name: 'Tonight' })).toHaveAttribute('href', '/plugins/tonight')
      await expect.element(card(screen, 'Word of the Day').getByText(/You already have/)).not.toBeInTheDocument()

      await moon.getByRole('button', { name: 'Import Moon Phase' }).click()

      await pluginPageOpened(screen)
      expect(faked.sent).toEqual([{ recipe: '41120' }])
    })

    it('assigns the imported Plugin to the Device the address carries', async () => {
      const faked = fakeGallery()
      const screen = await mountGallery('/plugins/recipes?device=kitchen')

      await expect.element(screen.getByRole('link', { name: 'Kitchen\'s Screens' })).toHaveAttribute('href', '/devices/kitchen')
      await expect.element(screen.getByText(/It is assigned to Kitchen as soon as it exists, at the end of the Order\./)).toBeVisible()
      await screen.getByRole('button', { name: 'Import Moon Phase' }).click()

      await pluginPageOpened(screen)
      expect(faked.sent).toEqual([{ recipe: '41120', deviceId: 'kitchen' }])
      await expect.element(screen.getByText(/Imported from the Recipe Moon Phase\. Assigned to Kitchen\./)).toBeVisible()
      await expect.element(screen.getByRole('link', { name: 'Back to Kitchen\'s Screens' })).toHaveAttribute('href', '/devices/kitchen')
    })

    it.each([
      [{ statusCode: 422, code: 'recipe-strategy-unsupported' as const, details: { strategy: 'plugin_merge' } }, 'This Recipe combines other TRMNL plugins, which Kuroshiro cannot import.'],
      [{ statusCode: 422, code: 'recipe-strategy-unsupported' as const, details: { strategy: 'static' } }, 'This Recipe\'s strategy is not one Kuroshiro can import.'],
      [{ statusCode: 502, code: 'upstream-unreachable' as const }, 'trmnl.com did not answer. Nothing was imported.'],
    ])('says in the card why a Recipe was refused, as Add a Plugin words it: %j', async (refusal, message) => {
      fakeGallery({ imported: refuseWith(refusal) })
      const screen = await mountGallery()

      await screen.getByRole('button', { name: 'Import Moon Phase' }).click()

      await expect.element(card(screen, 'Moon Phase').getByRole('alert')).toHaveTextContent(message)
      expect(address(screen)).toBe('/plugins/recipes')
    })
  })

  describe('with nothing to show', () => {
    it('says trmnl.com published no Recipes, and asks again on "Try again"', async () => {
      const faked = fakeGallery({ recipes: answerPage(pageOf([])) })
      const screen = await mountGallery()

      await expect.element(screen.getByRole('heading', { name: 'trmnl.com published no Recipes.' })).toBeVisible()
      const asked = faked.asked.length
      await screen.getByRole('button', { name: 'Try again' }).click()

      await expect.poll(() => faked.asked.length).toBe(asked + 1)
    })

    it('says what nothing matched, and shows every Recipe again', async () => {
      fakeGallery({ recipes: query => HttpResponse.json(query.has('search') || query.has('category') ? pageOf([]) : pageOf(RECIPES)) })
      const screen = await mountGallery('/plugins/recipes?q=zeppelin&category=calendar&sort=newest')

      await expect.element(screen.getByRole('heading', { name: 'No Recipe matches' })).toBeVisible()
      await expect.element(screen.getByText('No Recipe is called “zeppelin” in Calendar.')).toBeVisible()
      await screen.getByRole('button', { name: 'Show every Recipe' }).click()

      await expect.element(card(screen, 'Moon Phase')).toBeVisible()
      expect(address(screen)).toBe('/plugins/recipes?sort=newest')
      await expect.element(searchField(screen)).toHaveValue('')
    })
  })

  describe('loading and failing', () => {
    it('says "Loading Recipes" while the answer takes long', async () => {
      fakeGallery({ recipes: async () => {
        await delay('infinite')
        return HttpResponse.json(pageOf([]))
      } })
      const screen = await mountGallery()

      await expect.element(screen.getByRole('status').filter({ hasText: 'Loading Recipes' })).toBeVisible()
    })

    it.each([
      [{ statusCode: 502, code: 'upstream-unreachable' as const }, 'trmnl.com did not answer. No Recipes could be loaded.'],
      [{ statusCode: 503, code: 'upstream-busy' as const }, 'trmnl.com is busy with other requests. Wait a minute and try again.'],
    ])('says why no Recipes could be loaded, and loads them on "Try again": %j', async (refusal, notice) => {
      const faked = fakeGallery({ recipes: refuseWith(refusal) })
      const screen = await mountGallery()

      await expect.element(screen.getByRole('alert')).toHaveTextContent(notice)
      faked.recipes = answerPage(pageOf(RECIPES))
      await screen.getByRole('button', { name: 'Try again' }).click()

      await expect.element(card(screen, 'Moon Phase')).toBeVisible()
      await expect.element(screen.getByRole('alert')).not.toBeInTheDocument()
    })

    it('says Kuroshiro\'s server is not answering', async () => {
      fakeGallery({ recipes: () => HttpResponse.error() })
      const screen = await mountGallery()

      await expect.element(screen.getByRole('alert')).toHaveTextContent('Could not load the Recipes. Kuroshiro\'s server is not answering.')
    })
  })

  it('is accessible and does not overflow, with a Recipe already held and a refusal shown', async () => {
    fakeGallery({
      plugins: [buildPluginSummary({ id: 'tonight', name: 'Tonight', sourceRecipeId: '41120' })],
      imported: refuseWith({ statusCode: 422, code: 'recipe-strategy-unsupported', details: { strategy: 'plugin_merge' } }),
    })
    const screen = await mountGallery('/plugins/recipes?device=kitchen')
    await screen.getByRole('button', { name: 'Import Moon Phase' }).click()
    await expect.element(card(screen, 'Moon Phase').getByRole('alert')).toBeVisible()

    await expectAccessible()
    await expectNoHorizontalOverflow()
  })
})
