import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { api, apiUrl } from '@/testing/api/server'
import { fakeShellReads, mountApp } from '@/testing/app'
import { buildDeviceDetail, buildDeviceSummary } from '@/testing/fixtures/devices'
import { buildInstanceFacts, buildInstanceSettings } from '@/testing/fixtures/instance'
import { expectPageScreenshots } from '@/testing/screenshots'

const KITCHEN = buildDeviceSummary({ id: 'kitchen', name: 'Kitchen' })

describe('instance Settings', () => {
  it('with Notifications set up, a threshold set here and an age from the environment', async () => {
    fakeShellReads({
      instance: buildInstanceFacts({ version: '0.18.0', notifications: { configured: true, appriseUrl: 'http://apprise:8000' } }),
      devices: [KITCHEN],
    })
    api.use(
      http.get(apiUrl('devices/kitchen'), () => HttpResponse.json(buildDeviceDetail({ ...KITCHEN, refreshRate: 900 }))),
      http.get(apiUrl('settings'), () => HttpResponse.json(buildInstanceSettings({
        offlineMultiplier: { override: 4, value: 4, fallbackSource: 'default', fallbackValue: 3 },
        deviceLogRetentionDays: { override: null, value: 14, fallbackSource: 'env', fallbackValue: 14 },
      }))),
    )
    const screen = await mountApp({ at: '/instance/settings' })
    await expect.element(screen.getByRole('banner').getByRole('link', { name: 'Kitchen' })).toBeVisible()
    await expect.element(screen.getByRole('button', { name: 'Reset to 3' })).toBeVisible()
    await expect.element(screen.getByText('Kitchen polls every 15 minutes', { exact: false })).toBeVisible()
    await expect.element(screen.getByText('Kuroshiro 0.18.0')).toBeVisible()

    await expectPageScreenshots('instance-settings')
  })
})
