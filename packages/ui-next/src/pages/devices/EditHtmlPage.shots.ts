import { describe, expect, it } from 'vitest'
import { mountApp } from '@/testing/app'
import { arrived } from '@/testing/arrivals'
import { expectPageScreenshots } from '@/testing/screenshots'
import { holdPreviewLibrary } from '../plugins/__test__/pluginPageHarness'
import { fakeKitchen, kitchenScreen, SCREENS_OF_EVERY_KIND } from './__test__/screensViewHarness'

const FRIDGE_NOTE = kitchenScreen({
  id: 'fridge',
  name: 'Fridge note',
  order: 6,
  kind: 'html',
  plugin: null,
  html: [
    '<div class="layout layout--col layout--center">',
    '  <span class="value value--xlarge">Back at six</span>',
    '  <span class="description">Soup is in the fridge. {{ not Liquid here }}</span>',
    '</div>',
    '<div class="title_bar">',
    '  <span class="title">Fridge note</span>',
    '</div>',
  ].join('\n'),
})

describe('edit HTML', () => {
  it('an HTML Screen\'s markup beside its preview', async () => {
    fakeKitchen({ screens: [...SCREENS_OF_EVERY_KIND, FRIDGE_NOTE] })
    // The preview's frame loads TRMNL's framework from the network, so the plate is held in its rendering state.
    holdPreviewLibrary()
    const screen = await mountApp({ at: '/devices/kitchen/screens/fridge/html' })

    await expect.element(screen.getByRole('textbox', { name: 'HTML of Fridge note' })).toBeVisible()
    await arrived()
    await expectPageScreenshots('edit-html')
  })
})
