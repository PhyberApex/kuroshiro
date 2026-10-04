import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { api, apiUrl } from '@/testing/api/server'
import { fakeShellReads, mountApp } from '@/testing/app'
import { arrived } from '@/testing/arrivals'
import { buildAlert, buildAlertsList } from '@/testing/fixtures/alerts'
import { buildInstanceSettings } from '@/testing/fixtures/instance'
import { buildPluginDetail } from '@/testing/fixtures/plugins'
import { expectPageScreenshots } from '@/testing/screenshots'
import { freezeTime } from '@/testing/time'
import { fakePreviewData, holdPreviewLibrary } from './__test__/pluginPageHarness'

const source = buildPluginDetail().dataSources[0]!

const weather = buildPluginDetail({
  id: 'weather',
  dataSources: [
    {
      ...source,
      headers: { Accept: 'application/json' },
      transformJs: 'const hours = input.hourly.slice(0, 7)\nreturn { current: input.current, hourly: hours }',
      fetchFailureStreak: 6,
      lastFetchSucceededAt: '2026-10-03T04:30:00.000Z',
      lastFetchError: 'HTTP 502 Bad Gateway from api.open-meteo.com',
      alertFiring: true,
    },
    { ...source, id: 'pollen', name: 'pollen', method: 'POST', url: 'https://pollen.test/v1/today', fetchFailureStreak: 1, lastFetchError: 'HTTP 500' },
    { ...source, id: 'tides', name: 'tides', url: 'https://tides.test/v2/station/4411' },
    { ...source, id: 'holidays', name: 'holidays', mode: 'literal', method: null, url: null, headers: null, body: null, literalValue: { next: 'Reformation Day' }, lastFetchAttemptAt: null, lastFetchSucceededAt: null },
  ],
})

describe('the Data Sources of a Plugin', () => {
  it('with a Data Source whose Alert fires opened by the address', async () => {
    freezeTime('2026-10-03T07:35:00.000Z')
    fakeShellReads({
      alerts: buildAlertsList({ active: [buildAlert({ kind: 'data-source-fetch-failing', deviceId: undefined, deviceName: undefined, pluginId: 'weather', pluginName: 'Weather', dataSourceName: 'forecast', details: null })] }),
    })
    api.use(
      http.get(apiUrl('settings'), () => HttpResponse.json(buildInstanceSettings())),
      http.get(apiUrl('plugins/weather'), () => HttpResponse.json(weather)),
    )
    holdPreviewLibrary()
    fakePreviewData()
    const screen = await mountApp({ at: '/plugins/weather?source=forecast' })

    await expect.element(screen.getByRole('link', { name: '1 Alert firing' })).toBeVisible()
    await expect.element(screen.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Kitchen', exact: true })).toBeVisible()
    await expect.element(screen.getByRole('textbox', { name: 'Headers' })).toBeVisible()
    await arrived()
    window.scrollTo(0, 0)
    await expectPageScreenshots('plugin-data-sources')
  })
})
