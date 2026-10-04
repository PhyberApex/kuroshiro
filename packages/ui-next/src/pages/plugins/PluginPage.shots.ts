import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { api, apiUrl } from '@/testing/api/server'
import { fakeShellReads, mountApp } from '@/testing/app'
import { arrived } from '@/testing/arrivals'
import { buildAlert, buildAlertsList } from '@/testing/fixtures/alerts'
import { buildPluginDetail } from '@/testing/fixtures/plugins'
import { expectPageScreenshots } from '@/testing/screenshots'
import { freezeTime } from '@/testing/time'
import { fakePreviewData, holdPreviewLibrary } from './__test__/pluginPageHarness'
import { openPluginPage } from './pluginArrival'

const source = buildPluginDetail().dataSources[0]!

const weather = buildPluginDetail({
  id: 'weather',
  recipe: { id: '41120', name: 'Weather report', importedAt: '2026-09-12T09:20:00.000Z', snapshotTakenAt: null },
  dataSources: [{ ...source, fetchFailureStreak: 6, alertFiring: true }, { ...source, id: 'pollen', name: 'pollen', fetchFailureStreak: 1 }],
  fields: [{ id: 'latitude', keyname: 'latitude', label: 'Latitude', type: 'string', helpText: null, default: null, required: true, order: 0, options: null }],
  fieldValues: { latitude: { secret: false, value: null } },
  needsValues: true,
})

describe('the Plugin page', () => {
  it('with a firing Alert, two more problems, the line of an import, and the name changed and not saved', async () => {
    freezeTime('2026-10-03T07:35:00.000Z')
    fakeShellReads({
      alerts: buildAlertsList({ active: [buildAlert({ kind: 'data-source-fetch-failing', deviceId: undefined, deviceName: undefined, pluginId: 'weather', pluginName: 'Weather', dataSourceName: 'forecast', details: null })] }),
    })
    api.use(
      http.get(apiUrl('plugins'), () => HttpResponse.json([])),
      http.get(apiUrl('plugins/weather'), () => HttpResponse.json(weather)),
    )
    holdPreviewLibrary()
    fakePreviewData()
    const screen = await mountApp({ at: '/plugins' })
    await openPluginPage(screen.router, 'weather', { how: 'imported', origin: 'recipe', name: 'Weather report', hasTransform: true, device: { id: '3f6c1c1e-9d0a-4f39-8a53-0c2f0a1d7b11', name: 'Kitchen' } })

    await expect.element(screen.getByRole('link', { name: '1 Alert firing' })).toBeVisible()
    await expect.element(screen.getByRole('link', { name: 'Kitchen', exact: true })).toBeVisible()
    // Opened by its fragment and left by `blur()`: the shot files share one pointer, and a click here would leave it hovering in another file's shot.
    await screen.router.push({ hash: '#name' })
    const name = screen.getByRole('textbox', { name: 'Name' })
    await name.fill('Weather at home')
    await expect.element(screen.getByRole('region', { name: 'Unsaved changes' })).toBeVisible()
    ;(name.element() as HTMLElement).blur()
    await arrived()
    window.scrollTo(0, 0)
    await expectPageScreenshots('plugin-page')
  })
})
