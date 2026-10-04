import type { PluginDetail } from 'kuroshiro-shared'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { api, apiUrl } from '@/testing/api/server'
import { fakeShellReads, mountApp } from '@/testing/app'
import { arrived } from '@/testing/arrivals'
import { buildDeviceSummary } from '@/testing/fixtures/devices'
import { buildInstanceSettings } from '@/testing/fixtures/instance'
import { buildPluginDetail, buildPreviewData } from '@/testing/fixtures/plugins'
import { expectPageScreenshots } from '@/testing/screenshots'
import { freezeTime } from '@/testing/time'
import { fakePreviewData, holdPreviewLibrary } from './__test__/pluginPageHarness'

const TOKEN = 'wh8c1f02d94a7be6033f9a'

function parcels(webhook: Partial<NonNullable<PluginDetail['webhook']>>) {
  return buildPluginDetail({
    id: 'parcels',
    name: 'Parcel tracker',
    kind: 'Webhook',
    refreshInterval: null,
    dataSources: [],
    assignments: [{ deviceId: 'hallway', deviceName: 'Hallway', screenId: 'parcels-on-hallway', order: 2, screenCount: 2, state: null }],
    webhook: {
      token: TOKEN,
      url: `http://kuroshiro.local:3000/api/webhook/${TOKEN}`,
      mergeStrategy: 'stream',
      streamLimit: 20,
      payload: { parcels: [{ carrier: 'DHL', status: 'Out for delivery' }, { carrier: 'UPS', status: 'In transit' }], updated: '07:31' },
      payloadReceivedAt: '2026-10-03T07:31:00.000Z',
      ...webhook,
    },
  })
}

async function mountParcels(plugin: PluginDetail) {
  freezeTime('2026-10-03T07:35:00.000Z')
  fakeShellReads({ devices: [buildDeviceSummary({ id: 'hallway', name: 'Hallway' })] })
  api.use(
    http.get(apiUrl('settings'), () => HttpResponse.json(buildInstanceSettings())),
    http.get(apiUrl('plugins/parcels'), () => HttpResponse.json(plugin)),
  )
  holdPreviewLibrary()
  fakePreviewData(buildPreviewData(), 'parcels')
  const screen = await mountApp({ at: '/plugins/parcels' })
  await expect.element(screen.getByRole('button', { name: 'Regenerate the Webhook Token' })).toBeVisible()
  await arrived()
  window.scrollTo(0, 0)
  return screen
}

describe('the Webhook section of a Plugin', () => {
  it('a Stream with a stored Webhook Payload', async () => {
    const screen = await mountParcels(parcels({}))
    await expect.element(screen.getByRole('button', { name: 'Clear Webhook Payload' })).toBeVisible()
    await expectPageScreenshots('plugin-webhook')
  })

  it('nothing received yet', async () => {
    const screen = await mountParcels(parcels({ mergeStrategy: 'standard', streamLimit: null, payload: null, payloadReceivedAt: null }))
    await expect.element(screen.getByText('Nothing received yet. Until the first POST arrives the template renders without data.')).toBeVisible()
    await expectPageScreenshots('plugin-webhook-empty')
  })
})
