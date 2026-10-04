import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { api, apiUrl } from '@/testing/api/server'
import { fakeShellReads, mountApp } from '@/testing/app'
import { arrived } from '@/testing/arrivals'
import { buildInstanceSettings } from '@/testing/fixtures/instance'
import { buildPluginDetail } from '@/testing/fixtures/plugins'
import { expectPageScreenshots } from '@/testing/screenshots'
import { freezeTime } from '@/testing/time'
import { fakePreviewData, holdPreviewLibrary } from './__test__/pluginPageHarness'

const weather = buildPluginDetail({
  id: 'weather',
  name: 'Weather',
  recipe: { id: '41120', name: 'Weather', importedAt: '2026-09-12T08:00:00.000Z', snapshotTakenAt: '2026-10-01T09:00:00.000Z' },
})

describe('the Recipe of a Plugin', () => {
  it('imported from a Recipe whose Recipe Snapshot a check took over', async () => {
    freezeTime('2026-10-03T07:35:00.000Z')
    fakeShellReads()
    api.use(
      http.get(apiUrl('settings'), () => HttpResponse.json(buildInstanceSettings())),
      http.get(apiUrl('plugins/weather'), () => HttpResponse.json(weather)),
    )
    holdPreviewLibrary()
    fakePreviewData()
    const screen = await mountApp({ at: '/plugins/weather' })

    await expect.element(screen.getByRole('link', { name: 'Run a Recipe Update Check' })).toBeVisible()
    await expect.element(screen.getByRole('link', { name: 'Kitchen', exact: true }).first()).toBeVisible()
    await arrived()
    window.scrollTo(0, 0)
    await expectPageScreenshots('plugin-recipe')
  })
})
