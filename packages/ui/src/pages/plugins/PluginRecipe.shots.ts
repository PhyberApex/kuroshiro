import { describe, expect, it } from 'vitest'
import { buildPluginDetail } from '@/testing/fixtures/plugins'
import { shootPluginPage } from './__test__/pluginPageHarness'

const weather = buildPluginDetail({
  id: 'weather',
  name: 'Weather',
  recipe: { id: '41120', name: 'Weather', importedAt: '2026-09-12T08:00:00.000Z', snapshotTakenAt: '2026-10-01T09:00:00.000Z' },
})

describe('the Recipe of a Plugin', () => {
  it('imported from a Recipe whose Recipe Snapshot a check took over', async () => {
    await shootPluginPage('plugin-recipe', {
      at: '/plugins/weather',
      plugin: weather,
      assert: async (screen) => {
        await expect.element(screen.getByRole('link', { name: 'Run a Recipe Update Check' })).toBeVisible()
        await expect.element(screen.getByRole('link', { name: 'Kitchen', exact: true }).first()).toBeVisible()
      },
    })
  })
})
