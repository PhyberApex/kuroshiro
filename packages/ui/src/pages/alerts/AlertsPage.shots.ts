import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { api, apiUrl } from '@/testing/api/server'
import { fakeShellReads, mountApp } from '@/testing/app'
import { buildAlert, buildAlertsList } from '@/testing/fixtures/alerts'
import { buildDeviceSummary } from '@/testing/fixtures/devices'
import { buildInstanceFacts, buildInstanceSettings } from '@/testing/fixtures/instance'
import { expectPageScreenshots } from '@/testing/screenshots'
import { freezeTime } from '@/testing/time'

const devices = ['Kitchen', 'Hallway', 'Study'].map(name => buildDeviceSummary({ id: name.toLowerCase(), name }))

const fetchSubject = { deviceId: undefined, deviceName: undefined, dataSourceId: 'source' }

const alerts = buildAlertsList({
  active: [
    buildAlert({ id: 'fetch', kind: 'data-source-fetch-failing', ...fetchSubject, pluginId: 'trains', pluginName: 'Train departures', dataSourceName: 'departures', openedAt: '2026-10-03T06:10:00.000Z', details: { streak: 5, lastError: '503 Service Unavailable' } }),
    buildAlert({ id: 'offline', kind: 'device-offline', deviceId: 'study', deviceName: 'Study', openedAt: '2026-10-03T05:20:00.000Z', details: { lastSeen: '2026-10-03T04:31:00.000Z' } }),
    buildAlert({ id: 'battery', kind: 'device-low-battery', deviceId: 'hallway', deviceName: 'Hallway', openedAt: '2026-10-02T21:35:00.000Z', details: { percent: 14 } }),
  ],
  resolved: [
    buildAlert({ id: 'was-offline', kind: 'device-offline', deviceId: 'kitchen', deviceName: 'Kitchen', openedAt: '2026-09-30T02:10:00.000Z', resolvedAt: '2026-09-30T03:40:00.000Z', details: { lastSeen: '2026-09-30T01:05:00.000Z' } }),
    buildAlert({ id: 'was-failing', kind: 'data-source-fetch-failing', ...fetchSubject, pluginId: 'weather', pluginName: 'Weather', dataSourceName: 'forecast', openedAt: '2026-09-28T14:45:00.000Z', resolvedAt: '2026-09-28T15:30:00.000Z', details: { streak: 3, lastError: 'getaddrinfo ENOTFOUND api.open-meteo.com' } }),
    buildAlert({ id: 'was-low', kind: 'device-low-battery', deviceId: 'study', deviceName: 'Study', openedAt: '2026-09-27T09:20:00.000Z', resolvedAt: '2026-09-27T15:20:00.000Z', details: { percent: 17 } }),
  ],
})

describe('the Alerts page', () => {
  it('with an Alert of each kind firing, three resolved and Notifications set up', async () => {
    freezeTime('2026-10-03T07:35:00.000Z')
    fakeShellReads({ devices, alerts, instance: buildInstanceFacts({ notifications: { configured: true, appriseUrl: 'http://apprise:8000' } }) })
    api.use(http.get(apiUrl('settings'), () => HttpResponse.json(buildInstanceSettings())))
    const screen = await mountApp({ at: '/alerts' })
    await expect.element(screen.getByRole('link', { name: '3 Alerts firing' })).toBeVisible()
    await expect.element(screen.getByRole('heading', { name: 'Resolved in the last 7 days' })).toBeVisible()

    await expectPageScreenshots('alerts')
  })
})
