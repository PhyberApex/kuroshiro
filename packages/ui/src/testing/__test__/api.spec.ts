import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { api, apiErrorResponse, apiUrl } from '../api/server'
import { buildInstanceSettings } from '../fixtures/instance'
import { mountPage } from '../mount'
import SettingsPageExample from './examples/SettingsPageExample.vue'

const routes = [{ path: '/settings', component: SettingsPageExample }]

describe('the faked API', () => {
  it('answers a routed page from a typed fixture builder', async () => {
    api.use(http.get(apiUrl('settings'), () => HttpResponse.json(buildInstanceSettings({
      lowBatteryPercent: { override: 35, value: 35, fallbackSource: 'default', fallbackValue: 20 },
    }))))

    const screen = await mountPage({ routes, at: '/settings' })

    await expect.element(screen.getByRole('heading', { name: 'Settings' })).toBeVisible()
    await expect.element(screen.getByText('Low battery below 35 %')).toBeVisible()
    expect(screen.router.currentRoute.value.path).toBe('/settings')
  })

  it('answers a refusal in the error envelope with its status', async () => {
    api.use(http.get(apiUrl('settings'), () => apiErrorResponse({ statusCode: 503, code: 'service-unavailable' })))

    const screen = await mountPage({ routes, at: '/settings' })

    await expect.element(screen.getByRole('alert')).toHaveTextContent('Refused: service-unavailable')
  })

  it('drops a handler after the test that added it, and fails a request nothing fakes', async () => {
    await expect(fetch(apiUrl('settings'))).rejects.toThrow(TypeError)
  })

  it('leaves requests outside the admin API alone', async () => {
    const response = await fetch(new URL('favicon.svg', window.location.origin))

    expect(response.ok).toBe(true)
  })
})
