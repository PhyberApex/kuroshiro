import { describe, expect, it } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { defineComponent, h } from 'vue'
import { mount } from '@/testing/mount'
import { expectScreenshot } from '@/testing/screenshots'
import { THEMES } from '@/testing/theme'
import Select from './Select.vue'

const PALETTES = [
  { value: 'bw', label: '1-bit, black and white' },
  { value: 'gray-4', label: '2-bit, 4 greys' },
  { value: 'gray-16', label: '4-bit, 16 greys' },
  { value: 'color-6', label: 'Colour, 6 inks', disabled: true, reason: 'Not on TRMNL OG' },
]

const DEVICE_MODELS = ['TRMNL OG', 'TRMNL X', 'Kindle Paperwhite 3', 'Kindle Paperwhite 5', 'Kobo Libra 2', 'Kobo Clara HD', 'Inkplate 10', 'Inkplate 6', 'M5Paper S3']
  .map(label => ({ value: label.toLowerCase().replaceAll(' ', '-'), label }))

/** The open list is a layer above the page, so the shot is of a stage with room for it under the control. */
function onStage(options: object[], chosen: string, label: string) {
  return defineComponent(() => () => h(
    'div',
    { 'data-testid': 'stage', 'style': 'width: 24rem; height: 14rem; padding: 1rem; background: var(--color-paper)' },
    h(Select, { options, 'modelValue': chosen, 'aria-label': label } as never),
  ))
}

// The gallery shows a select closed, because an open list hides the rest of the page from assistive technology; its open states are shot here.
describe('select baselines', () => {
  it.for(THEMES)('the open list in %s', async (theme) => {
    const screen = await mount(onStage(PALETTES, 'gray-4', 'Palette'), { theme })

    await userEvent.keyboard('{Tab}{Enter}')
    await expect.element(screen.getByRole('option', { name: '2-bit, 4 greys' })).toHaveFocus()

    await expectScreenshot(page.elementLocator(screen.getByTestId('stage').element()), `select-open-${theme}`)
  })

  it.for(THEMES)('the combobox filtering in %s', async (theme) => {
    const screen = await mount(onStage(DEVICE_MODELS, 'trmnl-og', 'Device Model'), { theme })
    const stage = screen.getByTestId('stage').element()

    await screen.getByRole('combobox', { name: 'Device Model' }).fill('kindle')
    await expect.element(screen.getByRole('option', { name: 'Kindle Paperwhite 3' })).toBeVisible()

    await expectScreenshot(page.elementLocator(stage), `select-filtering-${theme}`)
  })
})
