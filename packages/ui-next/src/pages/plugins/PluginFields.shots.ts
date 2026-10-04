import type { PluginFieldRead } from 'kuroshiro-shared'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { api, apiUrl } from '@/testing/api/server'
import { fakeShellReads, mountApp } from '@/testing/app'
import { buildInstanceSettings } from '@/testing/fixtures/instance'
import { buildPluginDetail } from '@/testing/fixtures/plugins'
import { expectPageScreenshots } from '@/testing/screenshots'
import { freezeTime } from '@/testing/time'

function field(keyname: string, label: string, overrides: Partial<PluginFieldRead>): PluginFieldRead {
  return {
    id: keyname,
    keyname,
    label,
    type: 'string',
    helpText: null,
    default: null,
    required: false,
    order: 0,
    options: null,
    ...overrides,
  }
}

const weather = buildPluginDetail({
  id: 'weather',
  recipe: { id: '41120', name: 'Weather', importedAt: '2026-09-12T09:20:00.000Z', snapshotTakenAt: null },
  fields: [
    field('location', 'Location', { required: true, helpText: 'A place name or a postcode.' }),
    field('units', 'Units', { type: 'select', default: 'metric', options: [{ label: 'Metric', value: 'metric' }, { label: 'Imperial', value: 'imperial' }] }),
    field('days', 'Days ahead', { type: 'number' }),
    field('show_wind', 'Show wind', { type: 'boolean' }),
    field('greeting', 'Greeting', { type: 'text', helpText: 'Shown over the forecast.' }),
    field('api_key', 'API key', { type: 'password', required: true }),
    field('station_token', 'Station token', { type: 'password' }),
    field('author_bio', 'About this Plugin', { type: 'author_bio', helpText: 'Made by Mika at the harbour office, from the open forecast of the weather service.' }),
  ],
  fieldValues: {
    location: { secret: false, value: null },
    units: { secret: false, value: null },
    days: { secret: false, value: '3' },
    show_wind: { secret: false, value: 'true' },
    greeting: { secret: false, value: 'Moin, the weather for today' },
    api_key: { secret: true, set: false },
    station_token: { secret: true, set: true },
    author_bio: { secret: false, value: null },
  },
  needsValues: true,
})

describe('the Field Values and the Plugin Fields of a Plugin', () => {
  it('with required Plugin Fields empty and the tucked section opened by the address', async () => {
    freezeTime('2026-10-03T07:35:00.000Z')
    fakeShellReads()
    api.use(
      http.get(apiUrl('settings'), () => HttpResponse.json(buildInstanceSettings())),
      http.get(apiUrl('plugins/weather'), () => HttpResponse.json(weather)),
    )
    const screen = await mountApp({ at: '/plugins/weather#fields' })

    await expect.element(screen.getByRole('link', { name: 'Kitchen', exact: true }).first()).toBeVisible()
    await expect.element(screen.getByRole('button', { name: 'Add a Plugin Field' })).toBeVisible()
    await expect.element(screen.getByRole('button', { name: 'Replace Station token' })).toBeVisible()
    window.scrollTo(0, 0)
    await expectPageScreenshots('plugin-fields')
  })
})
