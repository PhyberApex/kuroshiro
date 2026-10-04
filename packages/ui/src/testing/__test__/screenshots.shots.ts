import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { api, apiUrl } from '../api/server'
import { buildInstanceSettings } from '../fixtures/instance'
import { mountPage } from '../mount'
import { expectPageScreenshots } from '../screenshots'
import SettingsPageExample from './examples/SettingsPageExample.vue'

describe('expectPageScreenshots', () => {
  it('takes a page\'s four shots: phone and desktop, light and dark', async () => {
    api.use(http.get(apiUrl('settings'), () => HttpResponse.json(buildInstanceSettings())))
    const screen = await mountPage({ routes: [{ path: '/settings', component: SettingsPageExample }], at: '/settings' })
    await expect.element(screen.getByText('Low battery below 20 %')).toBeVisible()

    await expectPageScreenshots('example-page')
  })
})
