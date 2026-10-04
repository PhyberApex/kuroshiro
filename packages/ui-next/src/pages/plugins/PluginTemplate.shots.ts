import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { api, apiUrl } from '@/testing/api/server'
import { fakeShellReads, mountApp } from '@/testing/app'
import { arrived } from '@/testing/arrivals'
import { buildInstanceSettings } from '@/testing/fixtures/instance'
import { buildPluginDetail, buildPluginField, buildPreviewData } from '@/testing/fixtures/plugins'
import { expectPageScreenshots, expectWindowScreenshot } from '@/testing/screenshots'
import { THEMES } from '@/testing/theme'
import { freezeTime } from '@/testing/time'
import { fakePreviewData, holdPreviewLibrary } from './__test__/pluginPageHarness'

const full = `<div class="layout layout--col layout--center">
  <span class="value value--xxlarge">{{ forecast.current.temperature | round }}°</span>
  <span class="label">{{ forecast.current.summary }}</span>
  {% if show_wind %}
    <span class="label">{{ forecast.current.wind }} km/h wind</span>
  {% endif %}
</div>
<div class="title_bar">
  <span class="title">{{ trmnl.plugin_settings.instance_name }}</span>
  <span class="instance">{{ location }}</span>
</div>`

const weather = buildPluginDetail({
  id: 'weather',
  fields: [
    buildPluginField({ id: 'location', keyname: 'location', label: 'Location' }),
    buildPluginField({ id: 'show_wind', keyname: 'show_wind', label: 'Show the wind', type: 'boolean', order: 1 }),
  ],
  fieldValues: { location: { secret: false, value: 'Lindenplatz' }, show_wind: { secret: false, value: 'true' } },
  templates: [
    { size: 'full', liquidMarkup: full },
    { size: 'half_horizontal', liquidMarkup: '<span class="value">{{ forecast.current.temperature | round }}°</span>' },
    { size: 'quadrant', liquidMarkup: '<span class="value">{{ forecast.current.temperature | round }}°</span>' },
  ],
})

const TRMNL = {
  system: { timestamp_utc: 1790926500 },
  plugin_settings: { instance_name: 'Weather', strategy: 'polling', dark_mode: 'no', no_screen_padding: 'no', custom_fields_values: { location: 'Lindenplatz', show_wind: 'true' } },
  user: { id: 'kuroshiro-user', locale: 'en' },
}

const fetched = buildPreviewData({
  context: {
    location: 'Lindenplatz',
    show_wind: 'true',
    forecast: { current: { temperature: 14.2, summary: 'Rain from 15:00', wind: 12 }, days: [{ high: 15, low: 9 }, { high: 17, low: 8 }, { high: 12, low: 7 }] },
    sensors: { temperature: { value: 21.5, unit: 'celsius' } },
    trmnl: TRMNL,
  },
  names: [
    { name: 'location', origin: 'fieldValue', error: null },
    { name: 'show_wind', origin: 'fieldValue', error: null },
    { name: 'forecast', origin: 'dataSource', error: null },
    { name: 'sensors', origin: 'sensors', error: null },
    { name: 'trmnl', origin: 'trmnl', error: null },
  ],
  fetchedAt: '2026-10-03T07:31:00.000Z',
})

const notFetched = buildPreviewData({
  ...fetched,
  context: { ...fetched.context, forecast: { error: true, message: 'HTTP 503 Service Unavailable' } },
  names: fetched.names.map(named => named.name === 'forecast' ? { ...named, error: 'HTTP 503 Service Unavailable' } : named),
})

function fakeWeather(plugin = weather, data = fetched) {
  freezeTime('2026-10-03T07:35:00.000Z')
  fakeShellReads()
  api.use(
    http.get(apiUrl('settings'), () => HttpResponse.json(buildInstanceSettings())),
    http.get(apiUrl('plugins/weather'), () => HttpResponse.json(plugin)),
  )
  holdPreviewLibrary()
  fakePreviewData(data)
}

// The plate is held in its rendering state: a drawn preview loads TRMNL's framework from the network.
describe('the Template section of a Plugin', () => {
  it('with three Templates, the full one in the editor, and "Data" opened by the address', async () => {
    fakeWeather()
    const screen = await mountApp({ at: '/plugins/weather#template-data' })

    await expect.element(screen.getByRole('link', { name: 'Kitchen', exact: true }).first()).toBeVisible()
    await expect.element(screen.getByRole('textbox', { name: 'Template of Weather, Full' })).toBeVisible()
    await expect.element(screen.getByText('Loading the preview')).toBeVisible()
    await expect.element(screen.getByRole('button', { name: 'Fetch again' })).toBeVisible()
    await arrived()
    window.scrollTo(0, 0)
    await expectPageScreenshots('plugin-template')
  })

  it('with the last scheduled render failed and a Data Source the preview could not fetch', async () => {
    fakeWeather(
      { ...weather, lastScheduledRender: { at: '2026-10-03T07:30:00.000Z', error: { message: 'undefined filter: rnd', line: 2, size: 'full' } } },
      notFetched,
    )
    const screen = await mountApp({ at: '/plugins/weather#template-data' })

    await expect.element(screen.getByRole('link', { name: 'Kitchen', exact: true }).first()).toBeVisible()
    await expect.element(screen.getByRole('textbox', { name: 'Template of Weather, Full' })).toBeVisible()
    await expect.element(screen.getByRole('button', { name: 'Go to line 2' })).toBeVisible()
    await expect.element(screen.getByRole('button', { name: 'Fetch again' })).toBeVisible()
    await arrived()
    window.scrollTo(0, 0)
    await expectPageScreenshots('plugin-template-problems')
  })

  // A shot of the window, not of the page: the full window fills it and scrolls inside itself.
  it.for(THEMES)('in the full window with unsaved changes, in %s', async (theme) => {
    fakeWeather()
    const screen = await mountApp({ at: '/plugins/weather#name', theme })
    await screen.getByRole('textbox', { name: 'Name' }).fill('Forecast')
    window.scrollTo(0, 0)
    await screen.router.push('/plugins/weather?view=template')

    await expect.element(screen.getByRole('heading', { name: 'Template of Weather', level: 2 })).toBeVisible()
    await expect.element(screen.getByRole('button', { name: 'Fetch again' })).toBeVisible()
    await expect.element(screen.getByRole('button', { name: 'Save Plugin' })).toBeVisible()
    await arrived()
    await expectWindowScreenshot(`plugin-template-window-${theme}`)
  })
})
