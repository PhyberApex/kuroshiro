import { describe, expect, it } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { defineComponent, h } from 'vue'
import { KUROSHIRO_FILTER_NAMES, WEATHER_DATA, WEATHER_TEMPLATE } from '@/gallery/editorSamples'
import { mount } from '@/testing/mount'
import { expectScreenshot } from '@/testing/screenshots'
import { THEMES } from '@/testing/theme'
import CodeEditor from './CodeEditor.vue'

const NAME = 'Template of Weather, Full'

const Stage = defineComponent(() => () => h(
  'div',
  { 'data-testid': 'stage', 'style': 'width: 40rem; padding: 1rem; background: var(--color-paper)' },
  h(CodeEditor, { 'modelValue': WEATHER_TEMPLATE, 'mode': 'liquid', 'completionData': WEATHER_DATA, 'kuroshiroFilters': KUROSHIRO_FILTER_NAMES, 'aria-label': NAME }),
))

async function mountFocused(theme: typeof THEMES[number]) {
  const screen = await mount(Stage, { theme })
  await expect.element(screen.getByRole('textbox', { name: NAME })).toBeVisible()
  await userEvent.keyboard('{Tab}{Control>}{End}{/Control}{Enter}')
  return screen
}

const offered = () => [...document.querySelectorAll('.cm-completionLabel')].map(label => label.textContent)

// Completion and search open on a key press, so the gallery cannot hold them; they are shot here.
describe('code editor baselines', () => {
  it.for(THEMES)('completing a name in %s', async (theme) => {
    const screen = await mountFocused(theme)

    await userEvent.keyboard('{{{{ forecast.current.')
    await expect.poll(offered).toContain('temperature')

    await expectScreenshot(page.elementLocator(screen.getByTestId('stage').element()), `code-editor-completing-${theme}`)
  })

  it.for(THEMES)('completing a filter in %s', async (theme) => {
    const screen = await mountFocused(theme)

    await userEvent.keyboard('{{{{ location | ')
    await userEvent.keyboard('{Control>} {/Control}')
    await expect.poll(offered).toContain('date_short')

    await expectScreenshot(page.elementLocator(screen.getByTestId('stage').element()), `code-editor-filters-${theme}`)
  })

  it.for(THEMES)('search and replace in %s', async (theme) => {
    const screen = await mountFocused(theme)

    await userEvent.keyboard('{Control>}f{/Control}')
    await expect.element(screen.getByRole('textbox', { name: 'Find' })).toHaveFocus()
    await userEvent.keyboard('span')
    await expect.poll(() => screen.container.querySelectorAll('.cm-searchMatch').length).toBeGreaterThan(0)

    await expectScreenshot(page.elementLocator(screen.getByTestId('stage').element()), `code-editor-search-${theme}`)
  })
})
