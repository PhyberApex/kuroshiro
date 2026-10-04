import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { api, apiUrl } from '@/testing/api/server'
import { fakeShellReads, mountApp } from '@/testing/app'
import { buildDeviceSummary } from '@/testing/fixtures/devices'
import { buildPluginSummary } from '@/testing/fixtures/plugins'
import { expectPageScreenshots } from '@/testing/screenshots'

describe('add a Plugin', () => {
  it('importing a Recipe that was imported before', async () => {
    fakeShellReads({ devices: [buildDeviceSummary({ id: 'kitchen', name: 'Kitchen' })] })
    api.use(http.get(apiUrl('plugins'), () => HttpResponse.json([buildPluginSummary({ id: 'weather', name: 'Weather', sourceRecipeId: '41120' })])))
    const screen = await mountApp({ at: '/plugins/new' })

    await expect.element(screen.getByRole('link', { name: 'Kitchen', exact: true })).toBeVisible()
    const recipe = screen.getByRole('textbox', { name: 'Recipe' })
    await recipe.fill('https://trmnl.com/recipes/41120')
    ;(recipe.element() as HTMLElement).blur()
    await expect.element(screen.getByRole('link', { name: 'Weather', exact: true })).toBeVisible()
    await expectPageScreenshots('add-plugin-recipe')
  })

  it('building a Webhook Plugin for a Device, with its name entered', async () => {
    fakeShellReads({ devices: [buildDeviceSummary({ id: 'kitchen', name: 'Kitchen' })] })
    const screen = await mountApp({ at: '/plugins/new?way=webhook&device=kitchen' })

    await expect.element(screen.getByRole('link', { name: 'Kitchen\'s Screens' })).toBeVisible()
    const name = screen.getByRole('textbox', { name: 'Name' })
    await name.fill('Doorbell note')
    ;(name.element() as HTMLElement).blur()
    await expect.element(screen.getByRole('radio', { name: 'Replace', exact: true })).toBeChecked()
    await expectPageScreenshots('add-plugin')
  })
})
