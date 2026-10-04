import type { ApiError, ApplyRecipeUpdateInput, PluginDetail, RecipeUpdatePreview, UpdateItem } from 'kuroshiro-shared'
import type { Locator } from 'vitest/browser'
import type { Mounted } from './pluginPageHarness'
import { delay, http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it } from 'vitest'
import { expectAccessible } from '@/testing/a11y'
import { api, apiErrorResponse, apiUrl } from '@/testing/api/server'
import { fakeShellReads, mountApp } from '@/testing/app'
import { buildPluginDetail, buildRecipeUpdatePreview, buildUpdateItem } from '@/testing/fixtures/plugins'
import { expectNoHorizontalOverflow } from '@/testing/overflow'
import { freezeTime } from '@/testing/time'
import { resetViewport } from '@/testing/viewport'
import { fakePlugin, mountPlugin, NOW } from './pluginPageHarness'

afterEach(() => resetViewport())

const WEATHER = buildPluginDetail({
  id: 'weather',
  name: 'Weather',
  recipe: { id: '41120', name: 'Weather', importedAt: '2026-09-12T08:00:00.000Z', snapshotTakenAt: '2026-09-12T08:00:00.000Z' },
})

const INTERVAL = buildUpdateItem({ itemType: 'refreshInterval', key: 'refreshInterval', snapshot: 15, local: 15, upstream: 30 })
const TEMPLATE = buildUpdateItem({
  itemType: 'template',
  key: 'full',
  snapshot: '<div class="item">\n  {{ temp }}°\n</div>',
  local: '<div class="item">\n  {{ temp }}°\n</div>',
  upstream: '<div class="item">\n  {{ temp }}{{ unit }}\n</div>',
})
const FORECAST = buildUpdateItem({
  itemType: 'dataSource',
  key: 'forecast',
  conflict: true,
  snapshot: { mode: 'fetch', method: 'GET', url: 'https://api.example.com/v1/forecast', headers: {}, body: {}, transformJs: null },
  local: { mode: 'fetch', method: 'GET', url: 'https://api.example.com/v1/forecast?units=metric', headers: {}, body: {}, transformJs: null },
  upstream: { mode: 'fetch', method: 'GET', url: 'https://api.example.com/v2/forecast', headers: {}, body: {}, transformJs: null },
})
const API_KEY = buildUpdateItem({
  itemType: 'field',
  key: 'api_key',
  kind: 'removed',
  snapshot: { keyname: 'api_key', label: 'API key', type: 'password', helpText: null, default: null, required: true, order: 2, options: null },
  local: { keyname: 'api_key', label: 'API key', type: 'password', helpText: null, default: null, required: true, order: 2, options: null },
  upstream: null,
} as Partial<UpdateItem>)
const CITY = buildUpdateItem({
  itemType: 'field',
  key: 'city',
  kind: 'added',
  snapshot: null,
  local: null,
  upstream: { keyname: 'city', label: 'City', type: 'string', helpText: null, default: null, required: true, order: 3, options: null },
} as Partial<UpdateItem>)

const CHANGED = buildRecipeUpdatePreview({ items: [INTERVAL, TEMPLATE, FORECAST, API_KEY, CITY], requiredFieldsLeftEmpty: ['city'] })

interface FakedCheck {
  /** How many times the check was run. */
  runs: number
  applied: ApplyRecipeUpdateInput[]
}

/** Answers the check with each answer in turn, the last one again, and keeps every apply. */
function fakeCheck(answers: Array<RecipeUpdatePreview | Partial<ApiError>>, applyAnswer?: Partial<ApiError>): FakedCheck {
  const faked: FakedCheck = { runs: 0, applied: [] }
  api.use(
    http.get(apiUrl('plugins/weather/recipe-update'), () => {
      const answer = answers[Math.min(faked.runs++, answers.length - 1)]!
      return 'contentHash' in answer ? HttpResponse.json(answer) : apiErrorResponse(answer)
    }),
    http.post(apiUrl('plugins/weather/recipe-update/apply'), async ({ request }) => {
      faked.applied.push(await request.json() as ApplyRecipeUpdateInput)
      return applyAnswer ? apiErrorResponse(applyAnswer) : HttpResponse.json(WEATHER, { status: 201 })
    }),
  )
  return faked
}

async function openCheck(plugin: PluginDetail = WEATHER) {
  fakePlugin(plugin)
  const screen = await mountPlugin('Weather', '/plugins/weather/update')
  return screen
}

const lede = () => document.querySelector('.lede')?.textContent?.replace(/\s+/g, ' ').trim()

/** What a diff reads, each run of white space as one space. */
const spokenOf = (list: Locator) => (list.query()?.textContent ?? '').replace(/\s+/g, ' ')

const box = (screen: Mounted, name: string) => screen.getByRole('checkbox', { name: `Apply ${name}` })

const row = (screen: Mounted, name: string) => screen.getByRole('button', { name, exact: true })

describe('the Recipe Update Check', () => {
  it('runs the check on opening, saying what it downloads', async () => {
    fakePlugin(WEATHER)
    api.use(http.get(apiUrl('plugins/weather/recipe-update'), async () => {
      await delay('infinite')
      return HttpResponse.json(CHANGED)
    }))
    const screen = await mountPlugin('Weather', '/plugins/weather/update')

    await expect.element(screen.getByRole('link', { name: 'Weather' })).toHaveAttribute('href', '/plugins/weather')
    await expect.element(screen.getByRole('heading', { name: 'Recipe Update Check', level: 2 })).toBeVisible()
    await expect.element(screen.getByRole('status')).toHaveTextContent('Downloading the Recipe Weather 41120 from TRMNL and comparing')
  })

  it('lists the Update Items in their groups, every one checked but a conflict', async () => {
    fakeCheck([CHANGED])
    const screen = await openCheck()

    await expect.poll(lede).toBe('The Recipe Weather 41120 changed in 5 places since 12 September 2026. Choose what Weather takes over. Nothing is applied until you say so.')
    expect(screen.getByRole('heading', { level: 3 }).elements().map(heading => heading.textContent?.trim())).toEqual(['Plugin details', 'Templates', 'Data Sources', 'Plugin Fields'])
    await expect.element(box(screen, 'Refresh interval')).toBeChecked()
    await expect.element(box(screen, 'Template full')).toBeChecked()
    await expect.element(box(screen, 'Data Source forecast')).not.toBeChecked()
    await expect.element(box(screen, 'Plugin Field api_key')).toBeChecked()
    await expect.element(screen.getByText('Conflict: you changed this too')).toBeVisible()
    await expect.element(screen.getByRole('button', { name: 'Apply 4 Update Items' })).toBeEnabled()
  })

  it('opens a row to its diff', async () => {
    fakeCheck([CHANGED])
    const screen = await openCheck()

    await row(screen, 'Template full').click()

    await expect.element(row(screen, 'Template full')).toHaveAttribute('aria-expanded', 'true')
    const diff = screen.getByRole('list', { name: 'The Recipe\'s change to Template full' })
    await expect.poll(() => spokenOf(diff)).toContain('removed: {{ temp }}°')
    expect(spokenOf(diff)).toContain('added: {{ temp }}{{ unit }}')
  })

  it('opens a conflict with your version over the Recipe\'s change', async () => {
    fakeCheck([CHANGED])
    const screen = await openCheck()

    await row(screen, 'Data Source forecast').click()

    await expect.element(screen.getByText('The Recipe and you both changed this Data Source since the Recipe Snapshot. Applying replaces your version with the Recipe\'s; headers you added yourself are kept.')).toBeVisible()
    await expect.element(screen.getByText('Yours reads:')).toBeVisible()
    await expect.poll(() => spokenOf(screen.getByRole('list', { name: 'Your Data Source forecast' }))).toContain('url: https://api.example.com/v1/forecast?units=metric')
    await expect.element(screen.getByText('The Recipe\'s change:')).toBeVisible()
    await expect.poll(() => spokenOf(screen.getByRole('list', { name: 'The Recipe\'s change to Data Source forecast' }))).toContain('added: url: https://api.example.com/v2/forecast')
  })

  it('says what applying a Plugin Field does to its Field Value and to the Plugin', async () => {
    fakeCheck([CHANGED])
    const screen = await openCheck()

    await row(screen, 'Plugin Field api_key').click()
    await expect.element(screen.getByText('Its Field Value is removed with it.')).toBeVisible()
    await row(screen, 'Plugin Field city').click()
    await expect.element(screen.getByText('It is required and has no default, so Weather is marked until you fill it in.')).toBeVisible()
  })

  it('counts the checked Update Items on the button, which cannot be pressed at none', async () => {
    fakeCheck([CHANGED])
    const screen = await openCheck()

    await box(screen, 'Data Source forecast').click()
    await expect.element(screen.getByRole('button', { name: 'Apply 5 Update Items' })).toBeVisible()
    for (const name of ['Refresh interval', 'Template full', 'Data Source forecast', 'Plugin Field api_key'])
      await box(screen, name).click()
    await expect.element(screen.getByRole('button', { name: 'Apply 1 Update Item' })).toBeVisible()
    await box(screen, 'Plugin Field city').click()

    await expect.element(screen.getByRole('button', { name: 'Apply 0 Update Items' })).toBeDisabled()
  })

  it('applies the chosen Update Items and opens the Plugin saying so', async () => {
    const check = fakeCheck([CHANGED])
    const screen = await openCheck()

    await box(screen, 'Template full').click()
    await screen.getByRole('button', { name: 'Apply 3 Update Items' }).click()

    await expect.element(screen.getByText('Applied 3 Update Items from the Recipe Weather.')).toBeVisible()
    expect(screen.router.currentRoute.value.path).toBe('/plugins/weather')
    expect(check.applied).toEqual([{
      contentHash: CHANGED.contentHash,
      apply: [{ itemType: 'refreshInterval', key: 'refreshInterval' }, { itemType: 'field', key: 'api_key' }, { itemType: 'field', key: 'city' }],
    }])
  })

  it('skips them all, which takes the Recipe Snapshot, and opens the Plugin saying so', async () => {
    const check = fakeCheck([CHANGED])
    const screen = await openCheck()

    await expect.element(screen.getByText('Either button makes the Recipe as it is now the Recipe Snapshot, so an Update Item you leave unchecked is not offered again. Cancel records nothing.')).toBeVisible()
    await screen.getByRole('button', { name: 'Skip all 5' }).click()

    await expect.element(screen.getByText('Skipped 5 Update Items from the Recipe Weather.')).toBeVisible()
    expect(check.applied).toEqual([{ contentHash: CHANGED.contentHash, apply: [] }])
  })

  it('goes back on "Cancel" and records nothing', async () => {
    const check = fakeCheck([CHANGED])
    const screen = await openCheck()

    await screen.getByRole('link', { name: 'Cancel' }).click()

    await expect.element(screen.getByRole('heading', { name: 'Devices', level: 2 })).toBeVisible()
    expect(check.applied).toEqual([])
  })

  it('shows the new comparison, every Update Item back at its default, when the Recipe changed while the page was open', async () => {
    const again = buildRecipeUpdatePreview({ contentHash: 'moved', items: [INTERVAL, TEMPLATE, FORECAST] })
    const check = fakeCheck([CHANGED, again], { statusCode: 409, code: 'recipe-changed' })
    const screen = await openCheck()

    await box(screen, 'Template full').click()
    await screen.getByRole('button', { name: 'Apply 3 Update Items' }).click()

    await expect.element(screen.getByText('The Recipe changed again while you were reading. This is the new comparison.')).toBeVisible()
    await expect.poll(lede).toMatch(/changed in 3 places/)
    await expect.element(box(screen, 'Template full')).toBeChecked()
    await expect.element(box(screen, 'Data Source forecast')).not.toBeChecked()
    expect(check.runs).toBe(2)
    expect(screen.router.currentRoute.value.path).toBe('/plugins/weather/update')
  })

  it('says there is nothing to apply when the Recipe has not changed', async () => {
    fakeCheck([buildRecipeUpdatePreview({ items: [] })])
    const screen = await openCheck()

    await expect.element(screen.getByRole('heading', { name: 'Nothing to apply' })).toBeVisible()
    await expect.element(screen.getByText('The Recipe Weather 41120 has not changed since Weather last took it over, on 12 September 2026. Your own changes to Weather are untouched.')).toBeVisible()
    await expect.element(screen.getByRole('link', { name: 'Back to Weather' })).toHaveAttribute('href', '/plugins/weather')
    expect(screen.getByRole('button', { name: /Apply|Skip/ }).elements()).toEqual([])
  })

  it.each([
    ['TRMNL does not answer', { statusCode: 502, code: 'upstream-unreachable' as const, details: { reason: 'fetch failed' } }, 'trmnl.com did not answer. Nothing was changed.'],
    ['TRMNL no longer has the Recipe', { statusCode: 422, code: 'recipe-not-found' as const, details: { id: '41120' } }, 'TRMNL no longer has the Recipe 41120. Weather keeps working as it is.'],
  ])('says why it could not download the Recipe when %s, and tries again', async (_when, refusal, reason) => {
    const check = fakeCheck([refusal, CHANGED])
    const screen = await openCheck()

    const notice = screen.getByRole('alert')
    await expect.element(notice).toHaveTextContent(`Could not download the Recipe. ${reason}`)
    await screen.getByRole('button', { name: 'Try again' }).click()

    await expect.poll(lede).toMatch(/changed in 5 places/)
    expect(check.runs).toBe(2)
  })

  it('lists every difference for a Plugin without a Recipe Snapshot, and saves one without applying anything', async () => {
    const twoWay = buildRecipeUpdatePreview({
      mode: 'two-way',
      snapshotTakenAt: null,
      items: [{ ...INTERVAL, snapshot: null }, { ...TEMPLATE, snapshot: null }] as UpdateItem[],
    })
    const check = fakeCheck([twoWay])
    const screen = await openCheck()

    await expect.poll(lede).toBe('Weather has no Recipe Snapshot, so Kuroshiro cannot tell your changes from the Recipe\'s. Every difference between Weather and the Recipe Weather 41120 is listed. Applying one replaces your version.')
    await row(screen, 'Refresh interval').click()
    await expect.poll(() => spokenOf(screen.getByRole('list', { name: 'The Recipe\'s change to Refresh interval' }))).toContain('removed: every 15 minutes')
    await screen.getByRole('button', { name: 'Apply nothing and save the Recipe Snapshot' }).click()

    await expect.element(screen.getByText('Skipped 2 Update Items from the Recipe Weather.')).toBeVisible()
    expect(check.applied).toEqual([{ contentHash: twoWay.contentHash, apply: [] }])
  })

  it('says so for a Plugin that was not imported from a Recipe, with the way back', async () => {
    const check = fakeCheck([CHANGED])
    const screen = await openCheck(buildPluginDetail({ id: 'weather', name: 'Weather', recipe: null }))

    await expect.element(screen.getByRole('heading', { name: 'Not from a Recipe' })).toBeVisible()
    await expect.element(screen.getByText('Weather was not imported from a Recipe, so there is nothing to check.')).toBeVisible()
    await expect.element(screen.getByRole('link', { name: 'Back to Weather' })).toHaveAttribute('href', '/plugins/weather')
    expect(check.runs).toBe(0)
  })

  it('shows "No Plugin here" for a Plugin that does not exist', async () => {
    const check = fakeCheck([CHANGED])
    fakeShellReads()
    api.use(http.get(apiUrl('plugins/gone'), () => apiErrorResponse({ statusCode: 404, code: 'plugin-not-found' })))
    freezeTime(NOW)
    const screen = await mountApp({ at: '/plugins/gone/update' })

    await expect.element(screen.getByRole('heading', { name: 'No Plugin here', level: 1 })).toBeVisible()
    await expect.element(screen.getByRole('link', { name: 'All Plugins' })).toHaveAttribute('href', '/plugins')
    expect(check.runs).toBe(0)
  })

  it('says the Plugin could not be loaded, and runs the check once it is', async () => {
    let reads = 0
    const check = fakeCheck([CHANGED])
    fakePlugin(WEATHER)
    api.use(http.get(apiUrl('plugins/weather'), () => reads++ === 0 ? apiErrorResponse({ statusCode: 500, code: 'internal' }) : HttpResponse.json(WEATHER)))
    freezeTime(NOW)
    const screen = await mountApp({ at: '/plugins/weather/update' })

    await expect.element(screen.getByText('Could not load the Plugin.')).toBeVisible()
    expect(check.runs).toBe(0)
    await screen.getByRole('button', { name: 'Try again' }).click()

    await expect.poll(lede).toMatch(/changed in 5 places/)
  })

  it('is accessible and does not overflow, with a diff opened', async () => {
    fakeCheck([buildRecipeUpdatePreview({ items: [INTERVAL, { ...TEMPLATE, upstream: `<p>${'x'.repeat(400)}</p>` } as UpdateItem, FORECAST, API_KEY, CITY] })])
    const screen = await openCheck()

    await row(screen, 'Template full').click()
    await row(screen, 'Data Source forecast').click()

    await expectAccessible()
    await expectNoHorizontalOverflow()
  })
})
