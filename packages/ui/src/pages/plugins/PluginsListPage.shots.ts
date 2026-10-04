import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { api, apiUrl } from '@/testing/api/server'
import { fakeShellReads, mountApp } from '@/testing/app'
import { buildAlert, buildAlertsList } from '@/testing/fixtures/alerts'
import { buildDeviceSummary } from '@/testing/fixtures/devices'
import { buildPluginPlace, buildPluginSummary } from '@/testing/fixtures/plugins'
import { expectPageScreenshots } from '@/testing/screenshots'

const device = (name: string) => ({ id: name.toLowerCase(), name })
const KITCHEN = device('Kitchen')
const HALLWAY = device('Hallway')
const STUDY = device('Study')

const plugins = [
  buildPluginSummary({ id: 'bins', name: 'Bin day', devices: [KITCHEN], worstFetchFailureStreak: 1 }),
  buildPluginSummary({ id: 'calendar', name: 'Calendar', devices: [KITCHEN, STUDY] }),
  buildPluginSummary({ id: 'doorbell', name: 'Doorbell note', kind: 'Webhook', devices: [HALLWAY], webhookPayloadStored: true }),
  buildPluginSummary({ id: 'moon', name: 'Moon phase', devices: [KITCHEN, HALLWAY, STUDY] }),
  buildPluginSummary({ id: 'parcels', name: 'Parcel tracker', kind: 'Webhook', devices: [], webhookPayloadStored: false }),
  buildPluginSummary({ id: 'pollen', name: 'Pollen count', sourceRecipeId: '41120', devices: [], needsValues: true }),
  buildPluginSummary({ id: 'tides', name: 'Tide table', sourceRecipeId: '9001', devices: [], mashups: [buildPluginPlace({ deviceId: 'study', deviceName: 'Study' })] }),
  buildPluginSummary({ id: 'trains', name: 'Train departures', sourceRecipeId: '77', devices: [KITCHEN], fetchAlertFiring: true, worstFetchFailureStreak: 6 }),
  buildPluginSummary({ id: 'weather', name: 'Weather', sourceRecipeId: '12', devices: [KITCHEN, HALLWAY] }),
  buildPluginSummary({ id: 'word', name: 'Word of the day', devices: [], worstFetchFailureStreak: 3 }),
]

describe('the Plugins list', () => {
  it('with ten Plugins on three Devices, every state of the state column and a fetch Alert firing', async () => {
    fakeShellReads({
      devices: [HALLWAY, KITCHEN, STUDY].map(({ id, name }) => buildDeviceSummary({ id, name })),
      alerts: buildAlertsList({ active: [buildAlert({ kind: 'data-source-fetch-failing', deviceId: undefined, deviceName: undefined, pluginId: 'trains', pluginName: 'Train departures', dataSourceName: 'departures', details: null })] }),
    })
    api.use(http.get(apiUrl('plugins'), () => HttpResponse.json(plugins)))
    const screen = await mountApp({ at: '/plugins' })

    await expect.element(screen.getByRole('link', { name: '1 Alert firing' })).toBeVisible()
    await expect.element(screen.getByRole('link', { name: 'Kitchen', exact: true })).toBeVisible()
    await expect.element(screen.getByRole('link', { name: 'Word of the day' })).toBeVisible()
    await expectPageScreenshots('plugins-list')
  })
})
