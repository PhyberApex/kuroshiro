import { describe, expect, it } from 'vitest'
import { arrived } from '@/testing/arrivals'
import { buildPluginSummary } from '@/testing/fixtures/plugins'
import { expectPageScreenshots } from '@/testing/screenshots'
import { holdPreviewLibrary } from '../plugins/__test__/pluginPageHarness'
import { mountAddScreen } from './__test__/addScreenHarness'
import { fakeKitchen } from './__test__/screensViewHarness'

const KITCHEN = { id: 'kitchen', name: 'Kitchen' }

const PLUGINS = [
  buildPluginSummary({ id: 'bins', name: 'Bin day', devices: [] }),
  buildPluginSummary({ id: 'calendar', name: 'Calendar', devices: [KITCHEN] }),
  buildPluginSummary({ id: 'doorbell', name: 'Doorbell note', kind: 'Webhook', devices: [] }),
  buildPluginSummary({ id: 'trains', name: 'Train departures', devices: [], needsValues: true }),
  buildPluginSummary({ id: 'weather', name: 'Weather', devices: [KITCHEN] }),
]

describe('add Screen', () => {
  it('a Plugin, with two of them already on the Device', async () => {
    fakeKitchen({ plugins: PLUGINS })
    const screen = await mountAddScreen('plugin')

    await expect.element(screen.getByRole('radio', { name: 'Bin day', exact: true })).toBeChecked()
    await expectPageScreenshots('add-screen-plugin')
  })

  it('a Mashup, with its name entered', async () => {
    fakeKitchen({ plugins: PLUGINS })
    const screen = await mountAddScreen('mashup')

    const name = screen.getByRole('textbox', { name: 'Name', exact: true })
    await name.fill('Weekend board')
    ;(name.element() as HTMLElement).blur()
    await expect.element(screen.getByRole('button', { name: 'Add Screen' })).toBeDisabled()
    await expectPageScreenshots('add-screen-mashup')
  })

  it('an HTML Screen, written in the code editor, with the preview loading', async () => {
    fakeKitchen({ plugins: PLUGINS })
    // The preview's frame loads TRMNL's framework from the network, so the plate is held in its rendering state.
    holdPreviewLibrary()
    const screen = await mountAddScreen('html')

    await expect.element(screen.getByRole('textbox', { name: 'HTML', exact: true })).toBeVisible()
    await arrived()
    await expectPageScreenshots('add-screen-html')
  })
})
