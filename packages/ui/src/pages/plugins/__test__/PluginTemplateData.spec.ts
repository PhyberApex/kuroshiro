import type { DeviceSummary, PluginDetail, PreviewDataInput, UpdatePluginInput } from 'kuroshiro-shared'
import type { Mounted } from './pluginPageHarness'
import { delay, http, HttpResponse } from 'msw'
import { describe, expect, it, onTestFinished } from 'vitest'
import { userEvent } from 'vitest/browser'
import { expectAccessible } from '@/testing/a11y'
import { api, apiUrl } from '@/testing/api/server'
import { fakeShellReads } from '@/testing/app'
import { arrived } from '@/testing/arrivals'
import { buildDeviceModel, buildPalette } from '@/testing/fixtures/device-models'
import { buildDeviceSummary } from '@/testing/fixtures/devices'
import { buildPluginDetail, buildPluginField, buildPreviewData } from '@/testing/fixtures/plugins'
import { expectNoHorizontalOverflow } from '@/testing/overflow'
import { elementsInSealColour } from '@/testing/sealColour'
import { resetViewport, resizeTo } from '@/testing/viewport'
import { clock, fakePlugin, fakePreviewLibrary, holdPreviewLibrary, mountPlugin, saveBar, WEATHER } from './pluginPageHarness'

const KITCHEN_ID = buildDeviceSummary().id

const FORECAST_SOURCE = WEATHER.dataSources[0]!

const FORECAST = { today: { summary: 'Rain from 15:00', high: 14 } }

const LOCATION = buildPluginField({ id: 'location', keyname: 'location', label: 'Location' })

const TEMPLATE = '<p>{{ forecast.today.summary }} at {{ location }}</p>'

function weatherWith(overrides: Partial<PluginDetail> = {}) {
  return buildPluginDetail({
    id: 'weather',
    name: 'Weather',
    templates: [{ size: 'full', liquidMarkup: TEMPLATE }],
    fields: [LOCATION],
    fieldValues: { location: { secret: false, value: 'Lindenplatz' } },
    ...overrides,
  })
}

/** The Plugin as the server answers a save of its Templates and Field Values. */
function withFormSaved(plugin: PluginDetail, input: UpdatePluginInput): PluginDetail {
  const fieldValues = Object.fromEntries(Object.entries(input.fieldValues ?? {}).map(([keyname, value]) => [keyname, { secret: false as const, value }]))
  return { ...plugin, templates: input.templates ?? plugin.templates, fieldValues: { ...plugin.fieldValues, ...fieldValues } }
}

function fakeWeather(overrides: Partial<PluginDetail> = {}, devices?: DeviceSummary[]) {
  const faked = fakePlugin(weatherWith(overrides), withFormSaved)
  faked.fetched = { forecast: FORECAST }
  if (devices)
    fakeShellReads({ devices })
  return faked
}

const PREVIEW_DATA = apiUrl('plugins/weather/preview-data')

/** Leaves every later fetch of the preview's data unanswered until `release` is called. */
function holdPreviewData() {
  let release = () => {}
  const held = new Promise<void>(resolve => (release = resolve))
  const asked: PreviewDataInput[] = []
  api.use(http.post(PREVIEW_DATA, async ({ request }) => {
    asked.push(await request.clone().json() as PreviewDataInput)
    await held
    return undefined
  }))
  return { asked, release }
}

/** The server stops answering the preview's fetches. */
const serverDown = (options: { once?: boolean } = {}) => api.use(http.post(PREVIEW_DATA, () => HttpResponse.error(), options))

const editor = (screen: Mounted, size = 'Full') => screen.getByRole('textbox', { name: `Template of Weather, ${size}`, exact: true })

async function mountTemplate(at?: string) {
  const screen = await mountPlugin('Weather', at)
  await expect.element(editor(screen)).toBeVisible()
  return screen
}

const drawn = () => [...document.querySelectorAll<HTMLIFrameElement>('#template iframe')].at(-1)?.srcdoc ?? ''

const read = (element: Element | null | undefined) => element?.textContent?.replace(/\s+/g, ' ').trim()

const code = (screen: Mounted, size = 'Full') => [...editor(screen, size).element().querySelectorAll('.cm-line')].map(line => line.textContent).join('\n')

async function type(screen: Mounted, keys: string, size = 'Full') {
  await editor(screen, size).click()
  await userEvent.keyboard(`{Control>}{End}{/Control}${keys}`)
}

const data = (screen: Mounted) => screen.getByRole('button', { name: /^Data / })
const dataTitle = () => read(document.querySelector('#template .template-data .trigger'))

/** The rows of "Data": each one's name, then its value and where it comes from. */
const rows = () => [...document.querySelectorAll('#template .data-list > li')].map(row => [...row.querySelectorAll('.name, .from')].map(read).join(' '))
const underRows = () => [...document.querySelectorAll('#template .data-foot .said')].map(read).filter(Boolean).join(' ')
const notices = () => [...document.querySelectorAll('#template .data-notices :is(.said, .unfetched)')].map(read)

async function openData(screen: Mounted) {
  await data(screen).click()
  await expect.poll(() => rows().length).toBeGreaterThan(0)
}

const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

describe('the fetched data of the Template section', () => {
  describe('previewing a Plugin with the fetched data', () => {
    it('draws the Template against the data the server fetched, and lists every name with where it comes from, in the answer\'s order', async () => {
      const faked = fakeWeather()
      faked.sensors = { [KITCHEN_ID]: { temperature: { value: 21.5, unit: 'celsius' } } }
      const screen = await mountTemplate()

      await expect.poll(drawn).toContain('<p>Rain from 15:00 at Lindenplatz</p>')
      expect(dataTitle()).toBe('Data 4 names, fetched just now')
      await expect.element(data(screen)).toHaveAttribute('aria-expanded', 'false')

      await openData(screen)

      expect(rows()).toEqual(['location "Lindenplatz" · Field Value', 'forecast Data Source', 'sensors Kitchen\'s Sensors', 'trmnl Kuroshiro'])
      expect(underRows()).toBe('Fetched for this preview only. It does not move a Fetch Failure Streak.')
      await expect.element(screen.getByRole('button', { name: 'Fetch again' })).toBeEnabled()

      await screen.getByRole('button', { name: 'forecast Data Source' }).click()
      await expect.poll(() => read(document.querySelector('#template .data-list pre'))).toBe('{ "today": { "summary": "Rain from 15:00", "high": 14 } }')
    })

    it('completes the keys of a fetched Data Source after a dot', async () => {
      fakeWeather()
      const screen = await mountTemplate()
      await expect.poll(drawn).toContain('Rain from 15:00')
      const offered = () => [...document.querySelectorAll('.cm-tooltip-autocomplete li')].map(option => option.textContent)

      await type(screen, '{Enter}{{{{ forecast.')

      await expect.poll(offered).toContainEqual(expect.stringContaining('today'))
      await userEvent.keyboard('today.')
      await expect.poll(offered).toEqual([expect.stringContaining('high'), expect.stringContaining('summary')])
    })
  })

  // These assert on the page's own real 800 ms debounce, which a loaded CI runner — coverage instrumentation
  // included — can see fire early or late; one retry tells that apart from an actual regression.
  describe('when the data is fetched', { retry: 1 }, () => {
    it('asks once when the section is first shown, with the form as it stands and the Device the preview is for', async () => {
      const faked = fakeWeather()
      await mountTemplate()
      await expect.poll(drawn).toContain('Rain from 15:00')

      expect(faked.previews).toEqual([{
        deviceId: KITCHEN_ID,
        name: 'Weather',
        dataSources: [expect.objectContaining({ id: FORECAST_SOURCE.id, name: 'forecast', mode: 'fetch', url: FORECAST_SOURCE.url })],
        fieldValues: { location: 'Lindenplatz' },
      }])
    })

    it('never asks for a Template edit, nor for a change of the name, which is drawn at once', async () => {
      const faked = fakeWeather({ templates: [{ size: 'full', liquidMarkup: '<p>{{ trmnl.plugin_settings.instance_name }}</p>' }] })
      const screen = await mountTemplate()
      await expect.poll(drawn).toContain('<p>Weather</p>')

      await type(screen, '{Enter}Bring an umbrella')
      await expect.poll(drawn).toContain('Bring an umbrella')
      await screen.router.push({ hash: '#name' })
      await screen.getByRole('textbox', { name: 'Name' }).fill('Forecast')
      await expect.poll(drawn).toContain('<p>Forecast</p>')
      await pause(1000)

      expect(faked.previews).toHaveLength(1)
    })

    // The 800 ms wait itself is pinned with fake timers in usePreviewData.node.spec.ts; on real timers a loaded
    // runner can stretch the gap between two changes past it, so this only proves the burst asks once, with the last value.
    it('draws a changed Field Value before the fetch it causes answers, and asks once after a burst of changes', async () => {
      const faked = fakeWeather()
      const screen = await mountTemplate()
      await expect.poll(drawn).toContain('<p>Rain from 15:00 at Lindenplatz</p>')
      const held = holdPreviewData()

      await screen.getByRole('textbox', { name: 'Location' }).fill('Markt')
      await screen.getByRole('textbox', { name: 'Location' }).fill('Marktplatz')
      await expect.poll(drawn).toContain('<p>Rain from 15:00 at Marktplatz</p>')

      await expect.poll(() => held.asked).toEqual([expect.objectContaining({ deviceId: KITCHEN_ID, fieldValues: { location: 'Marktplatz' } })])
      await pause(900)
      expect(held.asked).toHaveLength(1)
      expect(faked.previews).toHaveLength(1)
      held.release()
    })

    it('asks 800 ms after a Data Source changes, with the Data Source as the form holds it', async () => {
      const faked = fakeWeather()
      const screen = await mountTemplate()
      await expect.poll(drawn).toContain('Rain from 15:00')

      await screen.getByRole('button', { name: 'forecast', exact: true }).click()
      await screen.getByRole('region', { name: 'forecast', exact: true }).getByRole('textbox', { name: 'Request' }).fill('https://weather.test/today')

      await expect.poll(() => faked.previews.length).toBe(2)
      expect(faked.previews[1]).toMatchObject({ dataSources: [{ name: 'forecast', url: 'https://weather.test/today' }] })
    })

    describe('for another Device', () => {
      const kitchen = buildDeviceSummary({ id: KITCHEN_ID, name: 'Kitchen' })
      const hallway = buildDeviceSummary({ id: 'hallway', name: 'Hallway' })
      const gray4 = buildPalette({ id: 'gray-4', name: '4 Grays (2-bit)', usedBy: [{ id: KITCHEN_ID, name: 'Kitchen' }, { id: 'hallway', name: 'Hallway' }] })
      const og = buildDeviceModel({ paletteIds: ['gray-4'] })

      async function choose(screen: Mounted, option: string) {
        await screen.getByRole('combobox', { name: 'Preview for' }).click()
        await screen.getByRole('option', { name: option, exact: true }).click()
      }

      it('asks at once with that Device, and with no Device for "Another Device Model", whose Sensors row says so', async () => {
        const faked = fakeWeather({ templates: [{ size: 'full', liquidMarkup: '<p>{{ sensors.temperature.value }} degrees</p>' }] }, [hallway, kitchen])
        fakePreviewLibrary([og], [gray4])
        faked.sensors = { [KITCHEN_ID]: { temperature: { value: 21.5, unit: 'celsius' } }, hallway: { temperature: { value: 18, unit: 'celsius' } } }
        const screen = await mountTemplate()
        await expect.poll(drawn).toContain('<p>21.5 degrees</p>')

        await choose(screen, 'Hallway')
        await expect.poll(drawn).toContain('<p>18 degrees</p>')
        expect(faked.previews.map(asked => asked.deviceId)).toEqual([KITCHEN_ID, 'hallway'])

        await choose(screen, 'Another Device Model')
        await expect.poll(drawn).toContain('<p> degrees</p>')
        expect(faked.previews.map(asked => asked.deviceId)).toEqual([KITCHEN_ID, 'hallway', null])

        await openData(screen)
        expect(rows()).toContain('sensors {} · No Device, so no Sensors')
      })

      it('asks with no Device on an Instance without Devices', async () => {
        const faked = fakeWeather({ assignments: [] }, [])
        fakePreviewLibrary([og], [gray4])
        await mountTemplate()
        await expect.poll(drawn).toContain('Rain from 15:00')

        expect(faked.previews.map(asked => asked.deviceId)).toEqual([null])
      })
    })

    it('fetches again on "Fetch again", saying so with the button disabled and the drawing unchanged while it runs', async () => {
      const faked = fakeWeather()
      const screen = await mountTemplate()
      await expect.poll(drawn).toContain('Rain from 15:00')
      await openData(screen)
      const held = holdPreviewData()
      const drawing = document.querySelector('#template iframe')

      await screen.getByRole('button', { name: 'Fetch again' }).click()

      await expect.poll(underRows).toBe('Fetching the Data Sources')
      await expect.element(screen.getByRole('button', { name: 'Fetch again' })).toBeDisabled()
      expect(document.querySelector('#template iframe')).toBe(drawing)
      await expect.poll(() => held.asked).toHaveLength(1)
      expect(faked.previews).toHaveLength(1)
      held.release()
    })

    it('takes the answer of "Fetch again" into the drawing and the rows', async () => {
      const faked = fakeWeather()
      const screen = await mountTemplate()
      await expect.poll(drawn).toContain('Rain from 15:00')
      await openData(screen)

      faked.fetched = { forecast: { today: { summary: 'Sun all day' } } }
      await screen.getByRole('button', { name: 'Fetch again' }).click()

      await expect.poll(drawn).toContain('<p>Sun all day at Lindenplatz</p>')
      await expect.poll(underRows).toBe('Fetched for this preview only. It does not move a Fetch Failure Streak.')
      expect(faked.previews).toHaveLength(2)
    })
  })

  describe('problems with the data', () => {
    it('holds the plate in its rendering state with "Fetching the data" while the first data is on its way', async () => {
      fakeWeather()
      const held = holdPreviewData()
      const screen = await mountTemplate()

      await expect.element(screen.getByText('Fetching the data')).toBeVisible()
      expect(document.querySelector('#template iframe')).toBeNull()
      expect(document.querySelector('#template .template-data [aria-expanded]')).toBeNull()
      expect(code(screen)).toBe(TEMPLATE)

      api.use(http.post(PREVIEW_DATA, () => HttpResponse.json(buildPreviewData({ context: { forecast: FORECAST, location: 'Lindenplatz' } }))))
      held.release()
    })

    it('still draws the Template for a Data Source that could not be fetched, with its error marker, and says so under the honest line and in its row', async () => {
      const faked = fakeWeather({ templates: [{ size: 'full', liquidMarkup: '<p>{{ forecast.message }} at {{ location }}</p>' }] })
      faked.fetched = { forecast: { error: true, message: 'HTTP 503 Service Unavailable' } }
      const screen = await mountTemplate()

      await expect.poll(drawn).toContain('<p>HTTP 503 Service Unavailable at Lindenplatz</p>')
      expect(notices()).toEqual(['The Data Source forecast could not be fetched: HTTP 503 Service Unavailable.'])
      expect(document.querySelector('#template .data-notices svg')).not.toBeNull()

      await openData(screen)
      expect(rows()).toContain('forecast Data Source, not fetched')
      await screen.getByRole('button', { name: 'forecast Data Source, not fetched' }).click()
      await expect.element(screen.getByText('The preview\'s fetch failed: HTTP 503 Service Unavailable. The template reads an error marker in place of the data, as it would on the Device.')).toBeVisible()
      expect(elementsInSealColour(document.querySelector('#template')!)).toEqual([])
    })

    it('says that the data could not be fetched when the server does not answer, keeps the plate rendering, and draws once "Try again" works', async () => {
      const faked = fakeWeather()
      serverDown({ once: true })
      const screen = await mountTemplate()

      await expect.poll(notices).toEqual(['The data could not be fetched. Kuroshiro\'s server is not answering.'])
      expect(document.querySelector('#template iframe')).toBeNull()
      expect(document.querySelector('#template .plate')?.textContent).not.toContain('Fetching the data')
      expect(code(screen)).toBe(TEMPLATE)

      await screen.getByRole('button', { name: 'Try again' }).click()

      await expect.poll(drawn).toContain('<p>Rain from 15:00 at Lindenplatz</p>')
      expect(notices()).toEqual([])
      expect(faked.previews).toHaveLength(1)
    })

    it('keeps drawing against the earlier data when a later fetch gets no answer, and says from when it is', async () => {
      fakeWeather()
      const screen = await mountTemplate()
      await expect.poll(drawn).toContain('Rain from 15:00')
      await openData(screen)
      serverDown()

      await screen.getByRole('button', { name: 'Fetch again' }).click()

      await expect.poll(notices).toEqual(['The data could not be fetched. Kuroshiro\'s server is not answering. The preview uses the data from just now.'])
      await expect.element(screen.getByRole('button', { name: 'Try again' })).toBeVisible()
      await type(screen, ' today')
      await expect.poll(drawn).toContain('<p>Rain from 15:00 at Lindenplatz</p> today')
      expect(rows()).toContain('forecast Data Source')
    })
  })

  describe('where nothing is fetched', () => {
    it('shows a Webhook-kind Plugin its stored Webhook Payload and when it was received, with no button', async () => {
      const faked = fakeWeather({
        kind: 'Webhook',
        refreshInterval: null,
        dataSources: [],
        templates: [{ size: 'full', liquidMarkup: '<p>{{ visitor }} rang</p>' }],
        webhook: { token: 'wh_1', url: 'https://kuroshiro.test/api/plugins/webhook/wh_1', mergeStrategy: 'standard', streamLimit: null, payload: { visitor: 'Post', rings: 2 }, payloadReceivedAt: '2026-10-03T07:31:00.000Z' },
      })
      const screen = await mountTemplate()

      await expect.poll(drawn).toContain('<p>Post rang</p>')
      expect(dataTitle()).toBe('Data 5 names')
      await openData(screen)

      expect(rows()).toEqual(['location "Lindenplatz" · Field Value', 'visitor "Post" · Webhook Payload', 'rings 2 · Webhook Payload', 'sensors {} · Kitchen\'s Sensors', 'trmnl Kuroshiro'])
      expect(underRows()).toBe('The stored Webhook Payload, received 4 min ago.')
      expect(document.querySelector('#template .data-foot button')).toBeNull()
      expect(faked.previews[0]).not.toHaveProperty('dataSources')
    })

    it('says that a Webhook-kind Plugin has received nothing yet', async () => {
      fakeWeather({
        kind: 'Webhook',
        refreshInterval: null,
        dataSources: [],
        webhook: { token: 'wh_1', url: 'https://kuroshiro.test/api/plugins/webhook/wh_1', mergeStrategy: 'standard', streamLimit: null, payload: null, payloadReceivedAt: null },
      })
      const screen = await mountTemplate()
      await expect.poll(drawn).toContain('at Lindenplatz')
      await openData(screen)

      expect(underRows()).toBe('Nothing received yet.')
      expect(document.querySelector('#template .data-foot button')).toBeNull()
    })

    it('says that a Plugin without Data Sources fetches nothing, and names no fetch time', async () => {
      fakeWeather({ dataSources: [] })
      const screen = await mountTemplate()
      await expect.poll(drawn).toContain('at Lindenplatz')

      expect(dataTitle()).toBe('Data 3 names')
      await openData(screen)
      expect(underRows()).toBe('No Data Sources, so nothing is fetched.')
      expect(document.querySelector('#template .data-foot button')).toBeNull()
    })
  })

  describe('a password Field Value', () => {
    const fields = [LOCATION, buildPluginField({ id: 'api_key', keyname: 'api_key', label: 'API key', type: 'password', order: 1 })]

    it('reads as eight dots in "Data", and is in no request until the admin types a new one', async () => {
      const faked = fakeWeather({ fields, fieldValues: { location: { secret: false, value: 'Lindenplatz' }, api_key: { secret: true, set: true } } })
      const screen = await mountTemplate()
      await expect.poll(drawn).toContain('Rain from 15:00')
      await openData(screen)

      expect(rows()).toContain('api_key "••••••••" · Field Value')
      expect(faked.previews[0]?.fieldValues).toEqual({ location: 'Lindenplatz' })

      await screen.getByRole('textbox', { name: 'Location' }).fill('Marktplatz')
      await expect.poll(() => faked.previews.length).toBe(2)
      expect(faked.previews[1]?.fieldValues).toEqual({ location: 'Marktplatz' })

      await screen.getByRole('button', { name: 'Replace API key' }).click()
      await userEvent.keyboard('hunter2')
      await expect.poll(() => faked.previews.length).toBe(3)
      expect(faked.previews[2]?.fieldValues).toEqual({ location: 'Marktplatz', api_key: 'hunter2' })
      expect(rows()).toContain('api_key "••••••••" · Field Value')
      expect(document.querySelector('#template')?.textContent).not.toContain('hunter2')
    })
  })

  describe('the last scheduled render\'s failure', () => {
    const AT = '2026-10-03T07:30:00.000Z'
    const TWO = [{ size: 'full' as const, liquidMarkup: '<p>full</p>' }, { size: 'quadrant' as const, liquidMarkup: '<p>quarter</p>\n<p>{{ forecast.today.high | rnd }}</p>' }]
    const line = () => read(document.querySelector('#template .scheduled-failure .said'))

    it('stands between the heading and the Template line, and "Go to line" chooses the Template that failed and puts the cursor there', async () => {
      fakeWeather({ templates: TWO, lastScheduledRender: { at: AT, error: { message: 'undefined filter: rnd', line: 2, size: 'quadrant' } } })
      const screen = await mountTemplate()

      expect(line()).toBe(`The scheduled render at ${clock(AT)} failed at line 2: undefined filter: rnd. The preview draws with the data fetched now, so it may not fail the same way.`)
      const failure = document.querySelector('#template .scheduled-failure')!
      expect(failure.previousElementSibling?.querySelector('h2')).not.toBeNull()
      expect(failure.nextElementSibling?.classList.contains('template-line')).toBe(true)
      expect(elementsInSealColour(document.querySelector('#template')!)).toEqual([])

      await screen.getByRole('button', { name: 'Go to line 2' }).click()

      await expect.element(editor(screen, 'Quadrant')).toHaveFocus()
      await userEvent.keyboard('here ')
      await expect.poll(() => code(screen, 'Quadrant')).toBe('<p>quarter</p>\nhere <p>{{ forecast.today.high | rnd }}</p>')
    })

    it('offers no line to go to when the server\'s error names none, and is gone once a scheduled render works', async () => {
      const faked = fakeWeather({ templates: TWO, lastScheduledRender: { at: AT, error: { message: 'Maximum call stack size exceeded', line: null, size: 'full' } } })
      await mountTemplate()

      expect(line()).toBe(`The scheduled render at ${clock(AT)} failed: Maximum call stack size exceeded. The preview draws with the data fetched now, so it may not fail the same way.`)
      expect(document.querySelector('#template .scheduled-failure button')).toBeNull()

      faked.plugin = { ...faked.plugin, lastScheduledRender: { at: '2026-10-03T07:35:00.000Z', error: null } }
      window.dispatchEvent(new Event('focus'))

      await expect.poll(() => document.querySelector('#template .scheduled-failure')).toBeNull()
    })

    it('lands on the section from the page\'s problem line', async () => {
      fakeWeather({ lastScheduledRender: { at: AT, error: { message: 'undefined filter: rnd', line: 1, size: 'full' } } })
      const screen = await mountTemplate()

      await screen.getByRole('link', { name: 'Open the template' }).click()

      expect(screen.router.currentRoute.value.hash).toBe('#template')
    })
  })

  describe('the full window', () => {
    const section = () => document.querySelector<HTMLElement>('#template')!
    const view = (screen: Mounted) => screen.router.currentRoute.value.query.view

    it('takes the window under the bar at ?view=template, with "Data" open, and goes back to the page with everything as it was', async () => {
      const faked = fakeWeather({ templates: [{ size: 'full', liquidMarkup: '<p>{{ location }}</p>' }, { size: 'quadrant', liquidMarkup: '<p>quarter</p>' }] })
      const screen = await mountTemplate()
      await expect.poll(drawn).toContain('<p>Lindenplatz</p>')
      await screen.getByRole('radio', { name: 'Quadrant' }).click()
      await type(screen, ' past', 'Quadrant')
      await screen.getByRole('textbox', { name: 'Location' }).fill('Marktplatz')
      await expect.poll(() => faked.previews.length).toBe(2)
      await expect.element(screen.getByRole('heading', { name: 'Template', level: 2, exact: true })).toBeVisible()

      await screen.getByRole('button', { name: 'Full window' }).click()

      await expect.element(screen.getByRole('heading', { name: 'Template of Weather', level: 2 })).toBeVisible()
      expect(view(screen)).toBe('template')
      await expect.poll(() => getComputedStyle(section()).position).toBe('fixed')
      const bar = document.querySelector('header, .bar')!.getBoundingClientRect()
      await expect.poll(() => [Math.round(section().getBoundingClientRect().top), Math.round(section().getBoundingClientRect().bottom)]).toEqual([Math.round(bar.bottom), window.innerHeight])
      await expect.element(data(screen)).toHaveAttribute('aria-expanded', 'true')
      expect(rows()).toContain('location "Marktplatz" · Field Value')
      await expect.element(screen.getByRole('radio', { name: 'Quadrant' })).toBeChecked()
      expect(code(screen, 'Quadrant')).toBe('<p>quarter</p> past')
      await expect.element(screen.getByRole('button', { name: 'Back to the page' })).toHaveFocus()
      expect(document.getElementById('plugin-fieldValues-location')?.closest('[inert]')).not.toBeNull()
      expect(document.querySelector('h1')?.closest('[inert]')).not.toBeNull()
      expect(section().closest('[inert]')).toBeNull()
      expect(document.documentElement.style.overflow).toBe('hidden')
      const windowBar = saveBar(screen).element()
      expect(section().contains(windowBar)).toBe(true)
      await expect.poll(() => Math.round(windowBar.getBoundingClientRect().bottom)).toBe(window.innerHeight)

      await editor(screen, 'Quadrant').click()
      await userEvent.keyboard('{Control>}z{/Control}')
      await expect.poll(() => code(screen, 'Quadrant')).toBe('<p>quarter</p>')
      await userEvent.keyboard('{Control>}{Shift>}z{/Shift}{/Control}')

      await screen.getByRole('button', { name: 'Back to the page' }).click()

      await expect.element(screen.getByRole('heading', { name: 'Template', level: 2, exact: true })).toBeVisible()
      expect(view(screen)).toBeUndefined()
      expect(getComputedStyle(section()).position).not.toBe('fixed')
      await expect.element(data(screen)).toHaveAttribute('aria-expanded', 'false')
      expect([document.querySelector('[inert]'), document.documentElement.style.overflow]).toEqual([null, ''])
      await expect.element(screen.getByRole('radio', { name: 'Quadrant' })).toBeChecked()
      expect(code(screen, 'Quadrant')).toBe('<p>quarter</p> past')
      await expect.element(screen.getByRole('textbox', { name: 'Location' })).toHaveValue('Marktplatz')
      await expect.element(saveBar(screen).getByText('Unsaved changes to the template and Field Values. The preview already shows them.')).toBeVisible()
      await editor(screen, 'Quadrant').click()
      await userEvent.keyboard('{Control>}z{/Control}')
      await expect.poll(() => code(screen, 'Quadrant')).toBe('<p>quarter</p>')
      // usePreviewData debounces a Field Value or Data Source change by 800 ms (FETCHED_AFTER_MS); reading the
      // count right away only proves none has landed *yet*, which a loaded runner can still cross before this
      // line. Outlasting the debounce first proves the count the Template's undo/redo leave is a settled one.
      await pause(900)
      expect(faked.previews).toHaveLength(2)
    })

    it('opens in the full window from its address, saves there with the bar at the bottom of the window, and saves on the page too', async () => {
      const faked = fakeWeather({ templates: [{ size: 'full', liquidMarkup: '<p>full</p>' }] })
      const screen = await mountTemplate('/plugins/weather?view=template')
      await expect.element(screen.getByRole('heading', { name: 'Template of Weather', level: 2 })).toBeVisible()
      await expect.element(data(screen)).toHaveAttribute('aria-expanded', 'true')
      expect(document.querySelector('[aria-label="Unsaved changes"]')).toBeNull()

      await type(screen, ' wide')
      await saveBar(screen).getByRole('button', { name: 'Save Plugin' }).click()

      await expect.poll(() => faked.saves).toEqual([{ templates: [{ size: 'full', liquidMarkup: '<p>full</p> wide' }] }])
      await expect.poll(() => document.querySelector('[aria-label="Unsaved changes"]')).toBeNull()

      await screen.getByRole('button', { name: 'Back to the page' }).click()
      await expect.element(screen.getByRole('button', { name: 'Full window' })).toBeVisible()
      expect(screen.router.currentRoute.value.fullPath).toBe('/plugins/weather')
      await type(screen, ' narrow')
      await userEvent.keyboard('{Control>}s{/Control}')

      await expect.poll(() => faked.saves).toHaveLength(2)
      await expect.element(screen.getByText(/^Saved at/)).toBeVisible()
    })

    it('goes back to the page for "Show the first" when the first thing to fix is in another section', async () => {
      const faked = fakeWeather()
      const screen = await mountTemplate('/plugins/weather#name')
      await screen.getByRole('textbox', { name: 'Name' }).fill('')
      await screen.router.push('/plugins/weather?view=template')
      await expect.element(screen.getByRole('button', { name: 'Back to the page' })).toBeVisible()

      await saveBar(screen).getByRole('button', { name: 'Save Plugin' }).click()
      await saveBar(screen).getByRole('button', { name: 'Show the first' }).click()

      await expect.element(screen.getByRole('textbox', { name: 'Name' })).toHaveFocus()
      expect(view(screen)).toBeUndefined()
      expect(faked.saves).toEqual([])
    })

    it('goes back to the page with the browser\'s Back', async () => {
      fakeWeather()
      const screen = await mountTemplate()
      await screen.getByRole('button', { name: 'Full window' }).click()
      await expect.element(screen.getByRole('button', { name: 'Back to the page' })).toBeVisible()

      screen.router.back()

      await expect.element(screen.getByRole('button', { name: 'Full window' })).toBeVisible()
      expect(view(screen)).toBeUndefined()
    })

    it('is not offered on a phone, where its address shows the page', async () => {
      onTestFinished(resetViewport)
      await resizeTo(375)
      fakeWeather()
      const screen = await mountTemplate('/plugins/weather?view=template')

      await expect.element(screen.getByRole('heading', { name: 'Template', level: 2, exact: true })).toBeVisible()
      expect(screen.getByRole('button', { name: 'Full window' }).elements()).toEqual([])
      expect(screen.getByRole('button', { name: 'Back to the page' }).elements()).toEqual([])
      expect(getComputedStyle(section()).position).not.toBe('fixed')
      await expect.element(data(screen)).toHaveAttribute('aria-expanded', 'false')
      await expect.element(screen.getByRole('textbox', { name: 'Location' })).toBeVisible()
    })

    it('is accessible in the full window, with unsaved changes', async () => {
      fakeWeather()
      const screen = await mountTemplate('/plugins/weather?view=template')
      await expect.poll(drawn).toContain('Rain from 15:00')
      await type(screen, ' wide')
      await expect.element(saveBar(screen)).toBeVisible()
      await arrived()

      await expectAccessible()
    })
  })

  describe('loading', () => {
    it('lists the data while the Device Models are on their way, under the plate that waits for them', async () => {
      fakeWeather()
      holdPreviewLibrary()
      const screen = await mountTemplate()

      await expect.element(screen.getByText('Loading the preview')).toBeVisible()
      await openData(screen)
      expect(rows()).toContain('forecast Data Source')
    })
  })

  it('is accessible and does not overflow, with a Data Source not fetched, its row opened and the scheduled render failed', async () => {
    const faked = fakeWeather({ lastScheduledRender: { at: '2026-10-03T07:30:00.000Z', error: { message: 'undefined filter: rnd', line: 1, size: 'full' } } })
    faked.fetched = { forecast: { error: true, message: 'HTTP 503 Service Unavailable' } }
    const screen = await mountTemplate()
    await expect.poll(drawn).toContain('at Lindenplatz')
    await openData(screen)
    await screen.getByRole('button', { name: 'forecast Data Source, not fetched' }).click()
    await arrived()

    await expectAccessible()
    await expectNoHorizontalOverflow()
  })

  it('is accessible while the server does not answer', async () => {
    fakeWeather()
    serverDown()
    await mountTemplate()
    await expect.poll(notices).toHaveLength(1)
    await delay(0)

    await expectAccessible()
  })
})
