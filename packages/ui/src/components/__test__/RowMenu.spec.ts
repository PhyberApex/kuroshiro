import type { RowMenuItem } from '../rowMenuItem'
import { describe, expect, it, onTestFinished, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import { defineComponent, h } from 'vue'
import { expectAccessible } from '@/testing/a11y'
import { withCoarsePointer } from '@/testing/media'
import { mount, mountPage } from '@/testing/mount'
import { expectNoHorizontalOverflow } from '@/testing/overflow'
import Button from '../Button.vue'
import RowMenuGallery from '../RowMenu.gallery.vue'
import RowMenu from '../RowMenu.vue'

async function mountMenu(props: object = {}) {
  const actions = { duplicate: vi.fn(), exportIt: vi.fn(), remove: vi.fn() }
  const items: RowMenuItem[] = [
    { label: 'Open', to: '/plugins/weather' },
    { label: 'Duplicate', select: actions.duplicate },
    { label: 'Export', select: actions.exportIt, disabled: true },
    { label: 'Delete Plugin', select: actions.remove, ruleAbove: true },
  ]
  const List = defineComponent(() => () => h(RowMenu, { label: 'More actions for Weather', items, ...props }))
  const screen = await mountPage({
    routes: [{ path: '/plugins', component: List }, { path: '/plugins/weather', component: { render: () => h('h1', 'Weather') } }],
    at: '/plugins',
  })
  const trigger = screen.getByRole('button', { name: 'More actions for Weather' })
  // While the menu is open everything else is hidden from assistive technology, the trigger too.
  return { screen, actions, trigger, triggerElement: trigger.element() }
}

async function openByKeyboard(key = '{Enter}') {
  const mounted = await mountMenu()
  await userEvent.keyboard('{Tab}')
  await expect.element(mounted.trigger).toHaveFocus()
  await userEvent.keyboard(key)
  await expect.element(mounted.screen.getByRole('menu')).toBeVisible()
  return mounted
}

const item = (screen: { getByRole: Awaited<ReturnType<typeof mountMenu>>['screen']['getByRole'] }, name: string) => screen.getByRole('menuitem', { name })

describe('row menu', () => {
  it('is a button with the more icon, named by its label, that says it has a menu', async () => {
    const { trigger } = await mountMenu()

    await expect.element(trigger).toHaveAttribute('aria-haspopup', 'menu')
    await expect.element(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(trigger.element().querySelector('svg')).not.toBeNull()
  })

  it.for(['{Enter}', ' ', '{ArrowDown}'])('opens with %s, with the first item highlighted', async (key) => {
    const { screen, triggerElement } = await openByKeyboard(key)

    await expect.element(triggerElement).toHaveAttribute('aria-expanded', 'true')
    await expect.element(item(screen, 'Open')).toHaveFocus()
    expect(screen.getByRole('menuitem').elements().map(element => element.textContent?.trim()))
      .toEqual(['Open', 'Duplicate', 'Export', 'Delete Plugin'])
  })

  it('opens on a click', async () => {
    const { screen, trigger } = await mountMenu()

    await trigger.click()

    await expect.element(screen.getByRole('menu')).toBeVisible()
  })

  it('moves with the arrow keys and skips the disabled item', async () => {
    const { screen } = await openByKeyboard()

    await userEvent.keyboard('{ArrowDown}')
    await expect.element(item(screen, 'Duplicate')).toHaveFocus()
    await userEvent.keyboard('{ArrowDown}')
    await expect.element(item(screen, 'Delete Plugin')).toHaveFocus()
    await userEvent.keyboard('{ArrowUp}')
    await expect.element(item(screen, 'Duplicate')).toHaveFocus()
    await expect.element(item(screen, 'Export')).toHaveAttribute('aria-disabled', 'true')
  })

  it('activates the highlighted action with Enter, closes and gives the focus back', async () => {
    const { screen, actions, triggerElement } = await openByKeyboard()

    await userEvent.keyboard('{ArrowDown}')
    await expect.element(item(screen, 'Duplicate')).toHaveFocus()
    await userEvent.keyboard('{Enter}')

    await expect.element(screen.getByRole('menu')).not.toBeInTheDocument()
    expect(actions.duplicate).toHaveBeenCalledOnce()
    await expect.element(triggerElement).toHaveFocus()
  })

  it('follows a link item with Enter', async () => {
    const { screen } = await openByKeyboard()

    await expect.element(item(screen, 'Open')).toHaveAttribute('href', '/plugins/weather')
    await userEvent.keyboard('{Enter}')

    await expect.element(screen.getByRole('heading', { name: 'Weather' })).toBeVisible()
  })

  it('activates an action on a click', async () => {
    const { screen, actions, trigger } = await mountMenu()
    await trigger.click()

    await item(screen, 'Delete Plugin').click()

    expect(actions.remove).toHaveBeenCalledOnce()
    await expect.element(screen.getByRole('menu')).not.toBeInTheDocument()
  })

  it('does not fire a disabled item', async () => {
    const { screen, actions, trigger } = await mountMenu()
    await trigger.click()
    const disabled = item(screen, 'Export')
    await expect.poll(() => disabled.element().getBoundingClientRect().top).toBeGreaterThan(0)

    await disabled.click({ force: true })

    expect(actions.exportIt).not.toHaveBeenCalled()
  })

  it('closes on Escape, fires nothing and gives the focus back', async () => {
    const { screen, actions, triggerElement } = await openByKeyboard()

    await userEvent.keyboard('{Escape}')

    await expect.element(screen.getByRole('menu')).not.toBeInTheDocument()
    await expect.element(triggerElement).toHaveFocus()
    await expect.element(triggerElement).toHaveAttribute('aria-expanded', 'false')
    expect(Object.values(actions).every(action => action.mock.calls.length === 0)).toBe(true)
  })

  it('is drawn like the select\'s list: a 1 px ink border, no shadow, the highlighted item solid ink', async () => {
    const { screen } = await openByKeyboard()
    const list = item(screen, 'Open').element().parentElement!
    const ink = getComputedStyle(document.body).color

    await expect.poll(() => getComputedStyle(list).borderTopWidth).toBe('1px')
    expect(getComputedStyle(list).borderTopColor).toBe(ink)
    expect(getComputedStyle(list).boxShadow).toBe('none')
    await expect.poll(() => getComputedStyle(item(screen, 'Open').element()).backgroundColor).toBe(ink)
    expect(getComputedStyle(item(screen, 'Duplicate').element()).backgroundColor).toBe('rgba(0, 0, 0, 0)')
    expect(screen.getByRole('separator').elements()).toHaveLength(1)
  })

  it('opens from a worded button in its trigger slot, and says where each item stands beside its label', async () => {
    const add = vi.fn()
    const items: RowMenuItem[] = [{ label: 'Half horizontal', hint: 'top or bottom', select: () => {} }, { label: 'Quadrant', hint: 'a quarter', select: add }]
    const Line = defineComponent(() => () => h(RowMenu, { label: 'Add a template', items }, { trigger: () => h(Button, { variant: 'quiet' }, () => 'Add a template') }))
    const screen = await mountPage({ routes: [{ path: '/plugins', component: Line }], at: '/plugins' })
    const trigger = screen.getByRole('button', { name: 'Add a template' })

    await expect.element(trigger).toHaveAttribute('aria-haspopup', 'menu')
    expect(trigger.element().textContent?.trim()).toBe('Add a template')
    await trigger.click()

    const quadrant = screen.getByRole('menuitem', { name: 'Quadrant' })
    await expect.element(quadrant).toHaveAccessibleDescription('a quarter')
    expect(quadrant.element().textContent?.replace(/\s+/g, ' ').trim()).toBe('Quadrant a quarter')
    await quadrant.click()
    expect(add).toHaveBeenCalledOnce()
  })

  it('leaves the focus to an action that moves it itself, once the menu has closed', async () => {
    const elsewhere = document.createElement('input')
    document.body.append(elsewhere)
    onTestFinished(() => elsewhere.remove())
    const items: RowMenuItem[] = [{ label: 'Quadrant', select: () => {}, afterClose: () => elsewhere.focus() }]
    const Line = defineComponent(() => () => h(RowMenu, { label: 'Add a template', items }))
    const screen = await mountPage({ routes: [{ path: '/plugins', component: Line }], at: '/plugins' })

    await screen.getByRole('button', { name: 'Add a template' }).click()
    await screen.getByRole('menuitem', { name: 'Quadrant' }).click()

    await expect.poll(() => document.activeElement).toBe(elsewhere)
    expect(document.querySelector('[role="menu"]')).toBeNull()
  })

  it('does not open while disabled', async () => {
    const { screen, trigger } = await mountMenu({ disabled: true })

    await expect.element(trigger).toBeDisabled()
    await trigger.click({ force: true })

    await expect.element(screen.getByRole('menu')).not.toBeInTheDocument()
  })

  it('has 44 px items and a 44 px button at a coarse pointer', async () => {
    const { screen, triggerElement } = await openByKeyboard()

    await withCoarsePointer(async () => {
      expect(triggerElement.getBoundingClientRect().height).toBe(44)
      expect(item(screen, 'Duplicate').element().getBoundingClientRect().height).toBe(44)
    })
  })

  it('is accessible while open', async () => {
    const { screen } = await openByKeyboard()

    await expectAccessible(screen.getByRole('menu').element())
  })

  it('is accessible and does not overflow in every state', async () => {
    await mount(RowMenuGallery)

    await expectAccessible()
    await expectNoHorizontalOverflow()
  })
})
