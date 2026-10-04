import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { api, apiUrl } from '@/testing/api/server'
import { fakeShellReads, mountApp } from '@/testing/app'
import { arrived } from '@/testing/arrivals'
import { buildInstanceSettings } from '@/testing/fixtures/instance'
import { buildPluginDetail } from '@/testing/fixtures/plugins'
import { expectPageScreenshots } from '@/testing/screenshots'
import { freezeTime } from '@/testing/time'
import { holdPreviewLibrary } from './__test__/pluginPageHarness'

const full = `<div class="layout layout--col layout--center">
  <span class="value value--xxlarge">{{ forecast.current.temperature | round }}°</span>
  <span class="label">{{ forecast.current.summary }}</span>
  {% if show_wind %}
    <span class="label">{{ forecast.current.wind }} km/h wind</span>
  {% endif %}
</div>
<div class="title_bar">
  <span class="title">{{ trmnl.plugin_settings.instance_name }}</span>
  <span class="instance">{{ location }}</span>
</div>`

const weather = buildPluginDetail({
  id: 'weather',
  templates: [
    { size: 'full', liquidMarkup: full },
    { size: 'half_horizontal', liquidMarkup: '<span class="value">{{ forecast.current.temperature | round }}°</span>' },
    { size: 'quadrant', liquidMarkup: '<span class="value">{{ forecast.current.temperature | round }}°</span>' },
  ],
})

describe('the Template section of a Plugin', () => {
  // The plate is held in its rendering state: a drawn preview loads TRMNL's framework from the network.
  it('with three Templates, the full one in the editor', async () => {
    freezeTime('2026-10-03T07:35:00.000Z')
    fakeShellReads()
    api.use(
      http.get(apiUrl('settings'), () => HttpResponse.json(buildInstanceSettings())),
      http.get(apiUrl('plugins/weather'), () => HttpResponse.json(weather)),
    )
    holdPreviewLibrary()
    const screen = await mountApp({ at: '/plugins/weather' })

    await expect.element(screen.getByRole('link', { name: 'Kitchen', exact: true }).first()).toBeVisible()
    await expect.element(screen.getByRole('textbox', { name: 'Template of Weather, Full' })).toBeVisible()
    await expect.element(screen.getByText('Loading the preview')).toBeVisible()
    await arrived()
    window.scrollTo(0, 0)
    await expectPageScreenshots('plugin-template')
  })
})
