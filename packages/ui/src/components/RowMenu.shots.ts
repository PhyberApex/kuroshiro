import type { RowMenuItem } from './rowMenuItem'
import { describe, expect, it } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { defineComponent, h } from 'vue'
import { mountPage } from '@/testing/mount'
import { expectScreenshot } from '@/testing/screenshots'
import { THEMES } from '@/testing/theme'
import RowMenu from './RowMenu.vue'

const ITEMS: RowMenuItem[] = [
  { label: 'Open', to: '/plugins/weather' },
  { label: 'Duplicate', select: () => {} },
  { label: 'Export', select: () => {}, disabled: true },
  { label: 'Delete Plugin', select: () => {}, ruleAbove: true },
]

/** The open menu is a layer above the page, so the shot is of a stage with room for it under the button. */
const Stage = defineComponent(() => () => h(
  'div',
  { 'data-testid': 'stage', 'style': 'display: flex; justify-content: flex-end; width: 18rem; height: 13rem; padding: 1rem; background: var(--color-paper)' },
  h(RowMenu, { label: 'More actions for Weather', items: ITEMS }),
))

// The gallery shows a row menu closed, because an open one hides the rest of the page from assistive technology; its open states are shot here.
describe('row menu baselines', () => {
  it.for(THEMES)('open, with an item highlighted and one disabled, in %s', async (theme) => {
    const screen = await mountPage({ routes: [{ path: '/plugins', component: Stage }], at: '/plugins', theme })
    const stage = screen.getByTestId('stage').element()

    await userEvent.keyboard('{Tab}{Enter}')
    await expect.element(screen.getByRole('menuitem', { name: 'Open' })).toHaveFocus()
    await userEvent.keyboard('{ArrowDown}')
    await expect.element(screen.getByRole('menuitem', { name: 'Duplicate' })).toHaveFocus()

    await expectScreenshot(page.elementLocator(stage), `row-menu-open-${theme}`)
  })
})
