import type { UpdateItem } from 'kuroshiro-shared'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { api, apiUrl } from '@/testing/api/server'
import { fakeShellReads, mountApp } from '@/testing/app'
import { buildPluginDetail, buildRecipeUpdatePreview, buildUpdateItem } from '@/testing/fixtures/plugins'
import { expectPageScreenshots } from '@/testing/screenshots'
import { freezeTime } from '@/testing/time'

const weather = buildPluginDetail({
  id: 'weather',
  name: 'Weather',
  recipe: { id: '41120', name: 'Weather', importedAt: '2026-09-12T08:00:00.000Z', snapshotTakenAt: '2026-09-12T08:00:00.000Z' },
})

const forecast = (url: string) => ({ mode: 'fetch' as const, method: 'GET', url, headers: {}, body: {}, transformJs: null })
const units = (options: string[]) => ({ keyname: 'units', label: 'Units', type: 'select', helpText: null, default: 'metric', required: false, order: 1, options: options.map(value => ({ label: value, value })) })

const items = [
  buildUpdateItem({ itemType: 'refreshInterval', key: 'refreshInterval', snapshot: 15, local: 15, upstream: 30 }),
  buildUpdateItem({ itemType: 'template', key: 'full', snapshot: '<p>{{ temp }}°</p>', local: '<p>{{ temp }}°</p>', upstream: '<p>{{ temp }}{{ unit_sign }}</p>' }),
  buildUpdateItem({ itemType: 'template', key: 'quadrant', kind: 'added', snapshot: null, local: null, upstream: '<p>{{ temp }}</p>' }),
  buildUpdateItem({
    itemType: 'dataSource',
    key: 'forecast',
    conflict: true,
    snapshot: forecast('https://api.open-meteo.example/v1/forecast?q={{ location }}'),
    local: forecast('https://api.open-meteo.example/v1/forecast?q={{ location }}&units={{ units }}'),
    upstream: forecast('https://api.open-meteo.example/v2/forecast?place={{ location }}&units={{ units }}'),
  }),
  buildUpdateItem({ itemType: 'field', key: 'units', snapshot: units(['metric', 'imperial']), local: units(['metric', 'imperial']), upstream: units(['metric', 'imperial', 'scientific']) }),
  buildUpdateItem({
    itemType: 'field',
    key: 'api_key',
    kind: 'removed',
    snapshot: { keyname: 'api_key', label: 'API key', type: 'password', helpText: null, default: null, required: true, order: 2, options: null },
    local: { keyname: 'api_key', label: 'API key', type: 'password', helpText: null, default: null, required: true, order: 2, options: null },
    upstream: null,
  } as Partial<UpdateItem>),
] as UpdateItem[]

describe('the Recipe Update Check', () => {
  it('with six Update Items in four groups, one of them a conflict', async () => {
    freezeTime('2026-10-03T07:35:00.000Z')
    fakeShellReads()
    api.use(
      http.get(apiUrl('plugins/weather'), () => HttpResponse.json(weather)),
      http.get(apiUrl('plugins/weather/recipe-update'), () => HttpResponse.json(buildRecipeUpdatePreview({ items }))),
    )
    const screen = await mountApp({ at: '/plugins/weather/update' })

    await expect.element(screen.getByRole('link', { name: 'Kitchen', exact: true })).toBeVisible()
    await expect.element(screen.getByRole('button', { name: 'Apply 5 Update Items' })).toBeVisible()
    await expectPageScreenshots('recipe-update')
  })
})
