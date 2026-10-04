import type { DataSourceRead, PluginDetail, UpdatePluginInput } from 'kuroshiro-shared'
import type { Mounted } from './pluginPageHarness'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { userEvent } from 'vitest/browser'
import { expectAccessible } from '@/testing/a11y'
import { api, apiErrorResponse, apiUrl } from '@/testing/api/server'
import { fakeShellReads } from '@/testing/app'
import { arrived } from '@/testing/arrivals'
import { buildInstanceFacts, buildInstanceSettings } from '@/testing/fixtures/instance'
import { buildPluginDetail } from '@/testing/fixtures/plugins'
import { expectNoHorizontalOverflow } from '@/testing/overflow'
import { elementsInSealColour } from '@/testing/sealColour'
import { fakePlugin, mountPlugin, refresh, saveBar, WEATHER } from './pluginPageHarness'

const FORECAST = WEATHER.dataSources[0]!

const source = (overrides: Partial<DataSourceRead>): DataSourceRead => ({ ...FORECAST, ...overrides })

const NEVER_FETCHED = { fetchFailureStreak: 0, lastFetchAttemptAt: null, lastFetchSucceededAt: null, lastFetchError: null, alertFiring: false }

const HOLIDAYS = source({
  ...NEVER_FETCHED,
  id: 'holidays',
  name: 'holidays',
  mode: 'literal',
  method: null,
  url: null,
  headers: null,
  body: null,
  literalValue: { next: 'Reformation Day' },
})

const POLLEN = source({ id: 'pollen', name: 'pollen', url: 'https://pollen.test/today' })

const weatherWith = (dataSources: DataSourceRead[], overrides: Partial<PluginDetail> = {}) => buildPluginDetail({ id: 'weather', name: 'Weather', dataSources, ...overrides })

/** The Plugin as the server answers a save of its Data Sources: each as a read model, a kept one with the facts it had. */
function withSourcesSaved(plugin: PluginDetail, input: UpdatePluginInput): PluginDetail {
  const dataSources = input.dataSources?.map((sent, index): DataSourceRead => {
    const fetches = sent.mode === 'fetch'
    return {
      ...(plugin.dataSources.find(stored => stored.id === sent.id) ?? { ...NEVER_FETCHED, id: `saved-${index}` }),
      name: sent.name,
      mode: sent.mode,
      method: fetches ? sent.method ?? 'GET' : null,
      url: fetches ? sent.url ?? null : null,
      headers: fetches ? sent.headers ?? {} : null,
      body: fetches ? sent.body ?? {} : null,
      transformJs: fetches ? sent.transformJs ?? null : null,
      literalValue: fetches ? null : sent.literalValue ?? null,
    }
  })
  return {
    ...plugin,
    name: input.name ?? plugin.name,
    refreshInterval: input.refreshInterval ?? plugin.refreshInterval,
    dataSources: dataSources ?? plugin.dataSources,
  }
}

const fakeWeather = (dataSources: DataSourceRead[] = [FORECAST], overrides: Partial<PluginDetail> = {}) => fakePlugin(weatherWith(dataSources, overrides), withSourcesSaved)

const read = (element: Element | null | undefined) => element?.textContent?.replace(/\s+/g, ' ').trim()

const nameOf = (screen: Mounted, name: string) => screen.getByRole('button', { name, exact: true })
const rowOf = (screen: Mounted, name: string) => nameOf(screen, name).element().closest('li')!
const healthOf = (screen: Mounted, name: string) => read(rowOf(screen, name).querySelector('.health'))
const whatOf = (screen: Mounted, name: string) => read(rowOf(screen, name).querySelector('.what'))
const opened = (screen: Mounted, name: string) => screen.getByRole('region', { name, exact: true })
const storyOf = (screen: Mounted, name: string) => [...opened(screen, name).element().querySelectorAll('.story > :is(p, .code-block)')].map(read)

async function open(screen: Mounted, name: string) {
  await nameOf(screen, name).click()
  await expect.element(opened(screen, name)).toBeVisible()
  return opened(screen, name)
}

const field = (screen: Mounted, row: string, name: string) => opened(screen, row).getByRole('textbox', { name, exact: true })

/** A code input is typed in: the editor arrives after the row and takes its text from the keys. */
async function typeCode(screen: Mounted, row: string, name: string, keys: string) {
  const editor = field(screen, row, name)
  await expect.element(editor).toBeVisible()
  await editor.click()
  await userEvent.keyboard(`{Control>}a{/Control}{Backspace}${keys}`)
}

const codeOf = (screen: Mounted, row: string, name: string) => [...field(screen, row, name).element().querySelectorAll('.cm-line')].map(line => line.textContent).join('\n')

const interval = (screen: Mounted) => screen.getByRole('spinbutton', { name: 'Fetch' })

const leave = () => (document.activeElement as HTMLElement).blur()

async function save(screen: Mounted) {
  await saveBar(screen).getByRole('button', { name: 'Save Plugin' }).click()
}

describe('the Data Sources of a Plugin', () => {
  describe('the section', () => {
    it('stands under its heading with "Add a Data Source", the refresh interval first', async () => {
      fakeWeather()
      const screen = await mountPlugin()

      await expect.element(screen.getByRole('heading', { name: 'Data Sources', level: 2 })).toBeVisible()
      await expect.element(screen.getByRole('button', { name: 'Add a Data Source' })).toBeVisible()
      await expect.element(interval(screen)).toHaveValue(30)
      await expect.element(screen.getByRole('combobox', { name: 'Refresh interval unit' })).toHaveTextContent('minutes')
      await expect.element(screen.getByText('The refresh interval: how often Kuroshiro fetches every Data Source and renders Weather again. A Device shows the newest render at its own next poll.')).toBeVisible()
      expect(document.getElementById('data')).toBe(screen.getByRole('heading', { name: 'Data Sources' }).element().closest('section'))
    })

    it('is not there for a Webhook-kind Plugin, and neither is the refresh interval', async () => {
      const webhook = { token: 'tok', url: 'https://kuroshiro.test/api/webhook/tok', mergeStrategy: 'standard' as const, streamLimit: null, payload: null, payloadReceivedAt: null }
      fakeWeather([], { kind: 'Webhook', refreshInterval: null, webhook })
      const screen = await mountPlugin()

      await expect.element(screen.getByRole('button', { name: 'Name and description' })).toBeVisible()
      expect(screen.getByRole('heading', { name: 'Data Sources' }).elements()).toEqual([])
      expect(interval(screen).elements()).toEqual([])
    })

    it('says what a Plugin without Data Sources renders with, in place of the rows', async () => {
      fakeWeather([])
      const screen = await mountPlugin()

      await expect.element(screen.getByText('No Data Sources. The template renders without data. Add one to fetch JSON from an address, or to keep a fixed value.')).toBeVisible()
      expect(screen.getByRole('listitem').elements().filter(item => item.closest('#data'))).toEqual([])
    })
  })

  describe('the refresh interval', () => {
    it('is saved in minutes when it was changed', async () => {
      const faked = fakeWeather()
      const screen = await mountPlugin()

      await interval(screen).fill('2')
      await screen.getByRole('combobox', { name: 'Refresh interval unit' }).click()
      await screen.getByRole('option', { name: 'hours' }).click()
      await expect.element(saveBar(screen).getByText('Unsaved changes to the refresh interval.')).toBeVisible()
      await save(screen)

      await expect.poll(() => faked.saves).toEqual([{ refreshInterval: 120 }])
    })

    it('shows a longer interval that came with a Recipe as it is, and leaves it out of a save of something else', async () => {
      const faked = fakeWeather([FORECAST], { refreshInterval: 2880 })
      const screen = await mountPlugin()

      await expect.element(interval(screen)).toHaveValue(48)
      await expect.element(screen.getByRole('combobox', { name: 'Refresh interval unit' })).toHaveTextContent('hours')

      await open(screen, 'forecast')
      await field(screen, 'forecast', 'Request').fill('https://api.open-meteo.com/v2/forecast')
      await save(screen)

      await expect.poll(() => faked.saves).toHaveLength(1)
      expect(faked.saves[0]).not.toHaveProperty('refreshInterval')
      expect(faked.saves[0]).toHaveProperty('dataSources')
    })

    it.for([['0', 'minutes'], ['25', 'hours']] as const)('refuses %s %s with the range it takes', async ([amount, unit]) => {
      const faked = fakeWeather()
      const screen = await mountPlugin()

      await interval(screen).fill(amount)
      await screen.getByRole('combobox', { name: 'Refresh interval unit' }).click()
      await screen.getByRole('option', { name: unit }).click()
      await save(screen)

      await expect.element(saveBar(screen).getByText('1 thing to fix before this can be saved.')).toBeVisible()
      await expect.element(screen.getByText('Enter between 1 minute and 24 hours.')).toBeVisible()
      await expect.element(interval(screen)).toHaveAttribute('aria-invalid', 'true')
      expect(faked.saves).toEqual([])

      await saveBar(screen).getByRole('button', { name: 'Show the first' }).click()
      await expect.element(interval(screen)).toHaveFocus()
    })
  })

  describe('the rows', () => {
    it('show each Data Source in the Plugin\'s order with its name, what it is and its health', async () => {
      fakeWeather([
        FORECAST,
        source({ ...NEVER_FETCHED, id: 'air', name: 'air', method: 'POST', url: 'http://air.test/now' }),
        source({ id: 'tides', name: 'tides', fetchFailureStreak: 1, lastFetchError: 'HTTP 502' }),
        source({ id: 'trains', name: 'trains', fetchFailureStreak: 2, lastFetchError: 'HTTP 502' }),
        source({ id: 'pollen', name: 'pollen', fetchFailureStreak: 6, lastFetchError: 'HTTP 502', alertFiring: true }),
        HOLIDAYS,
      ])
      const screen = await mountPlugin()

      await expect.element(nameOf(screen, 'forecast')).toBeVisible()
      expect(screen.getByRole('heading', { level: 3 }).elements().map(read)).toEqual(['forecast', 'air', 'tides', 'trains', 'pollen', 'holidays'])
      expect(whatOf(screen, 'forecast')).toBe('GET api.open-meteo.com/v1/forecast?latitude={{ latitude }}&longitude={{ longitude }}')
      expect(whatOf(screen, 'air')).toBe('POST air.test/now')
      expect(whatOf(screen, 'holidays')).toBe('literal · a fixed value')
      expect(healthOf(screen, 'forecast')).toBe('Fetched 5 min ago')
      expect(healthOf(screen, 'air')).toBe('Not fetched yet')
      expect(healthOf(screen, 'tides')).toBe('The last fetch failed')
      expect(healthOf(screen, 'trains')).toBe('2 fetches failed in a row')
      expect(healthOf(screen, 'pollen')).toBe('Alert: keeps failing')
      expect(healthOf(screen, 'holidays')).toBe('')
    })

    it('paint only a firing Alert in the seal colour', async () => {
      fakeWeather([source({ fetchFailureStreak: 2, lastFetchError: 'HTTP 502' }), source({ id: 'pollen', name: 'pollen', fetchFailureStreak: 6, alertFiring: true })])
      const screen = await mountPlugin()

      await expect.element(nameOf(screen, 'pollen')).toBeVisible()
      expect(elementsInSealColour(rowOf(screen, 'forecast'))).toEqual([])
      expect(elementsInSealColour(rowOf(screen, 'pollen')).length).toBeGreaterThan(0)
    })

    it('open in place, one at a time', async () => {
      fakeWeather([FORECAST, HOLIDAYS])
      const screen = await mountPlugin()

      await open(screen, 'forecast')
      await open(screen, 'holidays')

      await expect.poll(() => opened(screen, 'forecast').elements()).toEqual([])
    })
  })

  describe('the story of an opened Data Source (capability 53)', () => {
    it('says when it was fetched', async () => {
      fakeWeather()
      const screen = await mountPlugin()
      await open(screen, 'forecast')

      expect(storyOf(screen, 'forecast')).toEqual(['Fetched 5 min ago, at the last scheduled render.'])
    })

    it('says that it was not fetched yet', async () => {
      fakeWeather([source(NEVER_FETCHED)])
      const screen = await mountPlugin()
      await open(screen, 'forecast')

      expect(storyOf(screen, 'forecast')).toEqual(['Not fetched yet. The first scheduled render fetches it.'])
    })

    it('tells a Fetch Failure Streak with the server\'s last error and when an Alert fires', async () => {
      fakeWeather([source({ fetchFailureStreak: 2, lastFetchAttemptAt: '2026-10-03T07:30:00.000Z', lastFetchSucceededAt: '2026-10-03T06:30:00.000Z', lastFetchError: 'HTTP 502 from api.open-meteo.com' })])
      api.use(http.get(apiUrl('settings'), () => HttpResponse.json(buildInstanceSettings({ fetchFailureThreshold: { override: 5, value: 5, fallbackSource: 'default', fallbackValue: 3 } }))))
      const screen = await mountPlugin()
      await open(screen, 'forecast')

      await expect.element(opened(screen, 'forecast').getByText('An Alert fires when the streak reaches 5.')).toBeVisible()
      expect(storyOf(screen, 'forecast')).toEqual([
        'Its Fetch Failure Streak is 2: the last 2 scheduled fetches failed, most recently 5 min ago.',
        'HTTP 502 from api.open-meteo.com',
        'Weather still renders. {{ forecast }} carries an error marker instead of data until a fetch succeeds.',
        'An Alert fires when the streak reaches 5.',
      ])
      expect(elementsInSealColour(opened(screen, 'forecast').element())).toEqual([])
    })

    it('words a streak of one as the last fetch', async () => {
      fakeWeather([source({ fetchFailureStreak: 1, lastFetchError: 'HTTP 502' })])
      const screen = await mountPlugin()
      await open(screen, 'forecast')

      expect(storyOf(screen, 'forecast')[0]).toBe('Its Fetch Failure Streak is 1: the last scheduled fetch failed, most recently 5 min ago.')
    })

    it('tells a firing Alert in red, without saying when one fires', async () => {
      fakeWeather([source({ fetchFailureStreak: 6, lastFetchError: 'HTTP 502 from api.open-meteo.com', alertFiring: true })])
      const screen = await mountPlugin()
      await open(screen, 'forecast')

      expect(storyOf(screen, 'forecast')).toEqual([
        'Alert: this Data Source keeps failing',
        'Its Fetch Failure Streak is 6: the last 6 scheduled fetches failed, most recently 5 min ago.',
        'HTTP 502 from api.open-meteo.com',
        'Weather still renders. {{ forecast }} carries an error marker instead of data until a fetch succeeds.',
      ])
      const alert = opened(screen, 'forecast').getByText('Alert: this Data Source keeps failing').element()
      expect(elementsInSealColour(alert.parentElement!)).toContain(alert)
    })

    it('says of a literal Data Source that nothing is fetched', async () => {
      fakeWeather([HOLIDAYS])
      const screen = await mountPlugin()
      await open(screen, 'holidays')

      expect(storyOf(screen, 'holidays')).toEqual(['A fixed value. Nothing is fetched, so it has no Fetch Failure Streak.'])
    })

    it('follows the 30-second refresh while what was entered stays', async () => {
      const faked = fakeWeather()
      const screen = await mountPlugin()
      await open(screen, 'forecast')
      await field(screen, 'forecast', 'Request').fill('https://api.open-meteo.com/v2/forecast')
      leave()

      faked.plugin = weatherWith([source({ fetchFailureStreak: 1, lastFetchError: 'HTTP 502' })])
      refresh()

      await expect.poll(() => healthOf(screen, 'forecast')).toBe('The last fetch failed')
      expect(storyOf(screen, 'forecast')[1]).toBe('HTTP 502')
      await expect.element(field(screen, 'forecast', 'Request')).toHaveValue('https://api.open-meteo.com/v2/forecast')
    })
  })

  describe('editing (capability 45)', () => {
    it('adds a Data Source, edits one and removes one, and saves the whole set with the ids of those it keeps', async () => {
      const faked = fakeWeather([FORECAST, HOLIDAYS, POLLEN])
      const screen = await mountPlugin()

      await screen.getByRole('button', { name: 'Add a Data Source' }).click()
      const name = field(screen, 'source', 'Name')
      await expect.element(name).toHaveFocus()
      expect([(name.element() as HTMLInputElement).selectionStart, (name.element() as HTMLInputElement).selectionEnd]).toEqual([0, 'source'.length])
      await expect.element(opened(screen, 'source').getByRole('radio', { name: 'Fetch' })).toBeChecked()
      await expect.element(opened(screen, 'source').getByRole('combobox', { name: 'Request method' })).toHaveTextContent('GET')
      expect(healthOf(screen, 'source')).toBe('Not fetched yet')

      await userEvent.keyboard('tides')
      await field(screen, 'tides', 'Request').fill('https://tides.test/v2/station/4411')

      await open(screen, 'forecast')
      await field(screen, 'forecast', 'Request').fill('https://api.open-meteo.com/v2/forecast')

      await open(screen, 'pollen')
      await opened(screen, 'pollen').getByRole('button', { name: 'Remove Data Source' }).click()

      await expect.element(saveBar(screen).getByText('Unsaved changes to the Data Sources.')).toBeVisible()
      await save(screen)

      await expect.poll(() => faked.saves).toEqual([{
        dataSources: [
          { id: FORECAST.id, name: 'forecast', mode: 'fetch', method: 'GET', url: 'https://api.open-meteo.com/v2/forecast', headers: {}, transformJs: null },
          { id: 'holidays', name: 'holidays', mode: 'literal', literalValue: { next: 'Reformation Day' } },
          { name: 'tides', mode: 'fetch', method: 'GET', url: 'https://tides.test/v2/station/4411', headers: {}, transformJs: null },
        ],
      }])
      await expect.poll(() => screen.getByRole('heading', { level: 3 }).elements().map(read)).toEqual(['forecast', 'holidays', 'tides'])
      await expect.poll(() => saveBar(screen).getByRole('button', { name: 'Save Plugin' }).elements()).toEqual([])
    })

    it('keeps an added Data Source open over the save that gives it its id', async () => {
      const faked = fakeWeather()
      const screen = await mountPlugin()
      await screen.getByRole('button', { name: 'Add a Data Source' }).click()
      await field(screen, 'source', 'Request').fill('https://tides.test/v2/station/4411')

      await save(screen)

      await expect.poll(() => faked.saves).toHaveLength(1)
      await expect.poll(() => saveBar(screen).getByRole('button', { name: 'Save Plugin' }).elements()).toEqual([])
      await expect.element(field(screen, 'source', 'Request')).toHaveValue('https://tides.test/v2/station/4411')
      expect(rowOf(screen, 'source').id).toBe('data-source-saved-1')
    })

    it('names an added Data Source source, or the next free source_n', async () => {
      fakeWeather([source({ name: 'source' })])
      const screen = await mountPlugin()

      await screen.getByRole('button', { name: 'Add a Data Source' }).click()
      await expect.element(field(screen, 'source_2', 'Name')).toHaveValue('source_2')

      await screen.getByRole('button', { name: 'Add a Data Source' }).click()
      await expect.element(field(screen, 'source_3', 'Name')).toHaveValue('source_3')
      expect(opened(screen, 'source_2').elements()).toEqual([])
    })

    it('strikes a removed Data Source through until the save, and puts it back', async () => {
      const faked = fakeWeather([FORECAST, HOLIDAYS])
      const screen = await mountPlugin()
      await open(screen, 'holidays')

      await opened(screen, 'holidays').getByRole('button', { name: 'Remove Data Source' }).click()

      await expect.poll(() => healthOf(screen, 'holidays')).toBe('Removed when you save · Put back')
      expect(opened(screen, 'holidays').elements()).toEqual([])
      await expect.element(nameOf(screen, 'holidays')).toBeDisabled()
      await expect.element(screen.getByRole('button', { name: 'Put back holidays' })).toHaveFocus()
      await expect.element(saveBar(screen).getByText('Unsaved changes to the Data Sources.')).toBeVisible()

      await screen.getByRole('button', { name: 'Put back holidays' }).click()

      await expect.poll(() => healthOf(screen, 'holidays')).toBe('')
      await expect.element(nameOf(screen, 'holidays')).toBeEnabled()
      await expect.poll(() => saveBar(screen).getByRole('button', { name: 'Save Plugin' }).elements()).toEqual([])
      expect(faked.saves).toEqual([])
    })

    it('drops a Data Source that was added and never saved at once', async () => {
      fakeWeather()
      const screen = await mountPlugin()
      await screen.getByRole('button', { name: 'Add a Data Source' }).click()

      await opened(screen, 'source').getByRole('button', { name: 'Remove Data Source' }).click()

      await expect.poll(() => screen.getByRole('heading', { level: 3 }).elements().map(read)).toEqual(['forecast'])
      await expect.poll(() => saveBar(screen).getByRole('button', { name: 'Save Plugin' }).elements()).toEqual([])
    })

    it('keeps what the other Data Source Mode held while switching', async () => {
      fakeWeather()
      const screen = await mountPlugin()
      const row = await open(screen, 'forecast')
      await expect.element(row.getByText('An HTTP request Kuroshiro makes at every scheduled render.')).toBeVisible()

      await row.getByRole('radio', { name: 'Literal' }).click()

      await expect.element(row.getByText('A fixed JSON value you type here.')).toBeVisible()
      expect(field(screen, 'forecast', 'Request').elements()).toEqual([])
      expect(whatOf(screen, 'forecast')).toBe('literal · a fixed value')
      expect(storyOf(screen, 'forecast')).toEqual(['A fixed value. Nothing is fetched, so it has no Fetch Failure Streak.'])
      await typeCode(screen, 'forecast', 'Value', '[[1, 2')

      await row.getByRole('radio', { name: 'Fetch' }).click()

      await expect.element(field(screen, 'forecast', 'Request')).toHaveValue(FORECAST.url!)

      await row.getByRole('radio', { name: 'Literal' }).click()

      await expect.element(field(screen, 'forecast', 'Value')).toBeVisible()
      await expect.poll(() => codeOf(screen, 'forecast', 'Value')).toBe('[1, 2]')
    })

    it('offers the body with POST only, and the transform tucked under its size', async () => {
      const faked = fakeWeather([source({ transformJs: 'const days = input.daily\nreturn { days }' })])
      const screen = await mountPlugin()
      const row = await open(screen, 'forecast')

      expect(field(screen, 'forecast', 'Body').elements()).toEqual([])
      await row.getByRole('combobox', { name: 'Request method' }).click()
      await screen.getByRole('option', { name: 'POST' }).click()
      await typeCode(screen, 'forecast', 'Body', '{{"region": "north"')

      await row.getByRole('button', { name: 'Transform · JavaScript, 2 lines' }).click()
      await expect.element(row.getByText('JavaScript that reshapes the response before the template sees it. It runs on this server at every fetch.')).toBeVisible()
      await typeCode(screen, 'forecast', 'Transform', '')
      await expect.element(row.getByRole('button', { name: 'Transform · none' })).toBeVisible()

      await save(screen)

      await expect.poll(() => faked.saves).toEqual([{
        dataSources: [{ id: FORECAST.id, name: 'forecast', mode: 'fetch', method: 'POST', url: FORECAST.url, headers: {}, body: { region: 'north' }, transformJs: null }],
      }])
    })
  })

  describe('the rules', () => {
    it('stop the save, each with its message, and "Show the first" opens the row and focuses the field', async () => {
      const faked = fakeWeather([FORECAST, POLLEN, HOLIDAYS], {
        fields: [{ id: 'latitude', keyname: 'latitude', label: 'Latitude', type: 'string', helpText: null, default: null, required: false, order: 0, options: null }],
        fieldValues: { latitude: { secret: false, value: '52.5' } },
      })
      const screen = await mountPlugin()

      await open(screen, 'forecast')
      await field(screen, 'forecast', 'Name').fill('latitude')
      await open(screen, 'holidays')
      await field(screen, 'holidays', 'Name').fill('trmnl')
      await open(screen, 'pollen')
      await field(screen, 'pollen', 'Request').fill('pollen.test/today')
      await nameOf(screen, 'pollen').click()
      await expect.poll(() => opened(screen, 'pollen').elements()).toEqual([])

      await save(screen)

      await expect.element(saveBar(screen).getByText('3 things to fix before this can be saved.')).toBeVisible()
      expect(faked.saves).toEqual([])

      await saveBar(screen).getByRole('button', { name: 'Show the first' }).click()
      await expect.element(field(screen, 'latitude', 'Name')).toHaveFocus()
      await expect.element(opened(screen, 'latitude').getByText('latitude is already the keyname of a Plugin Field.')).toBeVisible()

      await field(screen, 'latitude', 'Name').fill('forecast')
      await expect.element(saveBar(screen).getByText('2 things to fix before this can be saved.')).toBeVisible()
      await saveBar(screen).getByRole('button', { name: 'Show the first' }).click()
      await expect.element(field(screen, 'pollen', 'Request')).toHaveFocus()
      await expect.element(opened(screen, 'pollen').getByText('Enter an address that starts with http:// or https://.')).toBeVisible()

      await field(screen, 'pollen', 'Request').fill('https://pollen.test/today')
      await saveBar(screen).getByRole('button', { name: 'Show the first' }).click()
      await expect.element(field(screen, 'trmnl', 'Name')).toHaveFocus()
      await expect.element(opened(screen, 'trmnl').getByText('`trmnl` is taken by Kuroshiro.')).toBeVisible()

      await field(screen, 'trmnl', 'Name').fill('pollen')
      await expect.element(opened(screen, 'pollen').getByText('Another Data Source of Weather is called pollen.')).toBeVisible()

      await field(screen, 'pollen', 'Name').fill('')
      await expect.element(screen.getByText('A Data Source needs a name.')).toBeVisible()
    })

    it('mark headers that are not a JSON object on leaving the field, and stop the save', async () => {
      const faked = fakeWeather()
      const screen = await mountPlugin()
      await open(screen, 'forecast')
      const message = 'Headers must be a JSON object, like { "Accept": "application/json" }.'

      await typeCode(screen, 'forecast', 'Headers', '[["Accept"')
      expect(screen.getByText(message).elements()).toEqual([])

      leave()

      await expect.element(screen.getByText(message)).toBeVisible()
      await expect.element(field(screen, 'forecast', 'Headers')).toHaveAttribute('aria-invalid', 'true')
      await expect.element(field(screen, 'forecast', 'Headers')).toHaveAccessibleDescription(message)

      await save(screen)
      await expect.element(saveBar(screen).getByText('1 thing to fix before this can be saved.')).toBeVisible()
      expect(faked.saves).toEqual([])

      await nameOf(screen, 'forecast').click()
      await expect.poll(() => opened(screen, 'forecast').elements()).toEqual([])
      await saveBar(screen).getByRole('button', { name: 'Show the first' }).click()
      await expect.element(field(screen, 'forecast', 'Headers')).toHaveFocus()

      await typeCode(screen, 'forecast', 'Headers', '{{"Accept": "application/json"')
      await save(screen)

      await expect.poll(() => faked.saves.map(sent => sent.dataSources?.[0]?.headers)).toEqual([{ Accept: 'application/json' }])
    })

    it('refuse a body that is no JSON object and a literal value that is not JSON', async () => {
      fakeWeather([source({ method: 'POST' }), HOLIDAYS])
      const screen = await mountPlugin()

      await open(screen, 'forecast')
      await typeCode(screen, 'forecast', 'Body', '"north"')
      leave()
      await expect.element(screen.getByText('The body must be a JSON object.')).toBeVisible()

      await open(screen, 'holidays')
      await typeCode(screen, 'holidays', 'Value', '{{"next": ')
      leave()
      await expect.element(screen.getByText(/^This is not valid JSON: .+\.$/)).toBeVisible()
    })

    it('refuse an address that is not public in demo mode', async () => {
      const faked = fakeWeather()
      fakeShellReads({ instance: buildInstanceFacts({ demoMode: true }) })
      const screen = await mountPlugin()
      await open(screen, 'forecast')

      await field(screen, 'forecast', 'Request').fill('http://192.168.1.20/status')
      await save(screen)

      await expect.element(screen.getByText('In the demo a Data Source can only fetch a public address.')).toBeVisible()
      expect(faked.saves).toEqual([])
    })

    it('keep what was entered when the server refuses the save, and show its message at the field', async () => {
      fakeWeather([FORECAST, HOLIDAYS])
      api.use(http.patch(apiUrl('plugins/weather'), () => apiErrorResponse({
        statusCode: 400,
        code: 'validation',
        fields: [{ path: 'dataSources.0.url', message: 'url must start with http:// or https://' }],
      })))
      const screen = await mountPlugin()
      await open(screen, 'forecast')

      await field(screen, 'forecast', 'Request').fill('https://api.open-meteo.com/v2/forecast')
      await save(screen)

      await expect.element(opened(screen, 'forecast').getByText('url must start with http:// or https://')).toBeVisible()
      await expect.element(field(screen, 'forecast', 'Request')).toHaveValue('https://api.open-meteo.com/v2/forecast')
      await expect.element(saveBar(screen).getByRole('button', { name: 'Save Plugin' })).toBeVisible()
    })
  })

  describe('the address', () => {
    const MANY = Array.from({ length: 16 }, (_, index) => source({ id: `source-${index}`, name: `source_${index}` }))

    it('opens the Data Source ?source= names and scrolls to its row', async () => {
      fakeWeather([...MANY, POLLEN])
      const screen = await mountPlugin('Weather', '/plugins/weather?source=pollen')

      await expect.element(opened(screen, 'pollen')).toBeVisible()
      await expect.poll(() => window.scrollY).toBeGreaterThan(0)
      await expect.poll(() => rowOf(screen, 'pollen').getBoundingClientRect().top).toBeLessThan(window.innerHeight / 2)
    })

    it('opens none for a name no Data Source has', async () => {
      fakeWeather([FORECAST, POLLEN])
      const screen = await mountPlugin('Weather', '/plugins/weather?source=tides')

      await expect.element(nameOf(screen, 'forecast')).toBeVisible()
      expect(screen.getByRole('region', { name: /^(forecast|pollen)$/ }).elements()).toEqual([])
    })

    it('is where a problem line\'s "See the error" leads', async () => {
      fakeWeather([FORECAST, source({ id: 'pollen', name: 'pollen', fetchFailureStreak: 1, lastFetchError: 'HTTP 502 from pollen.test' })])
      const screen = await mountPlugin()

      await screen.getByRole('link', { name: 'See the error' }).click()

      await expect.element(opened(screen, 'pollen').getByText('HTTP 502 from pollen.test')).toBeVisible()
    })
  })

  it('is accessible and does not overflow with a failing Data Source opened', async () => {
    fakeWeather([source({ fetchFailureStreak: 6, lastFetchError: 'HTTP 502 from api.open-meteo.com/v1/forecast?latitude=52.52&longitude=13.41&hourly=temperature_2m', alertFiring: true, transformJs: 'return input' }), HOLIDAYS])
    const screen = await mountPlugin('Weather', '/plugins/weather?source=forecast')
    await expect.element(field(screen, 'forecast', 'Headers')).toBeVisible()
    await arrived(document.body)

    await expectAccessible()
    await expectNoHorizontalOverflow()
  })
})
