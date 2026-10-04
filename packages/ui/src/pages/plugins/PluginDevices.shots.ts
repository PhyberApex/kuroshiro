import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { api, apiUrl } from '@/testing/api/server'
import { fakeShellReads, mountApp } from '@/testing/app'
import { arrived } from '@/testing/arrivals'
import { buildDeviceSummary } from '@/testing/fixtures/devices'
import { buildInstanceSettings } from '@/testing/fixtures/instance'
import { buildPluginDetail, buildPluginPlace } from '@/testing/fixtures/plugins'
import { expectPageScreenshots } from '@/testing/screenshots'
import { freezeTime } from '@/testing/time'
import { fakePreviewData, holdPreviewLibrary } from './__test__/pluginPageHarness'

const devices = [
  buildDeviceSummary({ id: 'hallway', name: 'Hallway' }),
  buildDeviceSummary({ id: 'kitchen', name: 'Kitchen' }),
  buildDeviceSummary({ id: 'study', name: 'Study' }),
]

const weather = buildPluginDetail({
  id: 'weather',
  assignments: [
    { deviceId: 'kitchen', deviceName: 'Kitchen', screenId: 'weather-on-kitchen', order: 2, screenCount: 6, state: 'active' },
    { deviceId: 'hallway', deviceName: 'Hallway', screenId: 'weather-on-hallway', order: 1, screenCount: 2, state: 'scheduleOff' },
  ],
  mashups: [buildPluginPlace({ screenId: 'weekend-board', name: 'Weekend board', deviceId: 'kitchen', deviceName: 'Kitchen' })],
})

describe('the Devices of a Plugin', () => {
  it('on two of three Devices, one Screen active and one with its Schedule off, and in a Mashup', async () => {
    freezeTime('2026-10-03T07:35:00.000Z')
    fakeShellReads({ devices })
    api.use(
      http.get(apiUrl('settings'), () => HttpResponse.json(buildInstanceSettings())),
      http.get(apiUrl('plugins/weather'), () => HttpResponse.json(weather)),
    )
    holdPreviewLibrary()
    fakePreviewData()
    const screen = await mountApp({ at: '/plugins/weather' })

    await expect.element(screen.getByRole('button', { name: 'Assign to Study' })).toBeVisible()
    await expect.element(screen.getByRole('link', { name: 'Open the Mashup' })).toBeVisible()
    await arrived()
    window.scrollTo(0, 0)
    await expectPageScreenshots('plugin-devices')
  })
})
