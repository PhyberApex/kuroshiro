import type { NavItem } from '../navItem'
import { describe, expect, it } from 'vitest'
import { userEvent } from 'vitest/browser'
import { defineComponent, h } from 'vue'
import { expectAccessible } from '@/testing/a11y'
import { withCoarsePointer } from '@/testing/media'
import { mount, mountPage } from '@/testing/mount'
import { expectNoHorizontalOverflow } from '@/testing/overflow'
import { resetViewport, resizeTo } from '@/testing/viewport'
import TabsGallery from '../Tabs.gallery.vue'
import Tabs from '../Tabs.vue'

const VIEWS: NavItem[] = [
  { label: 'Screens', to: '/devices/kitchen' },
  { label: 'Settings', to: '/devices/kitchen/settings' },
  { label: 'Logs', to: '/devices/kitchen/logs' },
]

const DeviceView = defineComponent(() => () => h(Tabs, { label: 'Kitchen', items: VIEWS }))

function mountTabs(at: string) {
  return mountPage({
    routes: [...VIEWS.map(view => view.to as string), '/devices/kitchen/screens/new'].map(path => ({ path, component: DeviceView })),
    at,
  })
}

describe('tabs', () => {
  it('is a named navigation of links, each with its own address, and not a tablist', async () => {
    const screen = await mountTabs('/devices/kitchen')
    const nav = screen.getByRole('navigation', { name: 'Kitchen' })

    expect(nav.getByRole('link').elements().map(link => [link.textContent?.trim(), link.getAttribute('href')])).toEqual([
      ['Screens', '/devices/kitchen'],
      ['Settings', '/devices/kitchen/settings'],
      ['Logs', '/devices/kitchen/logs'],
    ])
    expect(screen.container.querySelector('[role="tablist"], [role="tab"]')).toBeNull()
  })

  it('marks the link of the current route as the current page, and follows the route', async () => {
    const screen = await mountTabs('/devices/kitchen/settings')

    await expect.element(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('aria-current', 'page')
    await expect.element(screen.getByRole('link', { name: 'Screens' })).not.toHaveAttribute('aria-current')
    await expect.element(screen.getByRole('link', { name: 'Logs' })).not.toHaveAttribute('aria-current')

    await screen.router.push('/devices/kitchen/logs')

    await expect.element(screen.getByRole('link', { name: 'Logs' })).toHaveAttribute('aria-current', 'page')
    await expect.element(screen.getByRole('link', { name: 'Settings' })).not.toHaveAttribute('aria-current')
  })

  it('keeps the nearest tab above current on a route that has no tab of its own', async () => {
    const screen = await mountTabs('/devices/kitchen/screens/new')

    await expect.element(screen.getByRole('link', { name: 'Screens' })).toHaveAttribute('aria-current', 'page')
    expect(screen.container.querySelectorAll('[aria-current]')).toHaveLength(1)
  })

  it('draws a 2 px ink line under the current tab only', async () => {
    const screen = await mountTabs('/devices/kitchen')
    const current = screen.getByRole('link', { name: 'Screens' })

    await expect.poll(() => getComputedStyle(current.element()).borderBottomWidth).toBe('2px')
    await expect.poll(() => getComputedStyle(current.element()).borderBottomColor).toBe(getComputedStyle(document.body).color)
    expect(getComputedStyle(screen.getByRole('link', { name: 'Logs' }).element()).borderBottomColor).toBe('rgba(0, 0, 0, 0)')
  })

  it('reaches every tab with Tab and opens one with Enter', async () => {
    const screen = await mountTabs('/devices/kitchen')

    await userEvent.keyboard('{Tab}')
    await expect.element(screen.getByRole('link', { name: 'Screens' })).toHaveFocus()
    await userEvent.keyboard('{Tab}')
    await expect.element(screen.getByRole('link', { name: 'Settings' })).toHaveFocus()
    await userEvent.keyboard('{Tab}')
    await expect.element(screen.getByRole('link', { name: 'Logs' })).toHaveFocus()

    await userEvent.keyboard('{Enter}')

    await expect.element(screen.getByRole('link', { name: 'Logs' })).toHaveAttribute('aria-current', 'page')
    expect(screen.router.currentRoute.value.path).toBe('/devices/kitchen/logs')
  })

  it('opens a tab on a click', async () => {
    const screen = await mountTabs('/devices/kitchen')

    await screen.getByRole('link', { name: 'Settings' }).click()

    await expect.element(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('aria-current', 'page')
  })

  it('stays one row on a phone', async () => {
    const screen = await mountTabs('/devices/kitchen')

    await resizeTo(375)
    try {
      const tops = screen.getByRole('link').elements().map(link => link.getBoundingClientRect().top)
      expect(new Set(tops).size).toBe(1)
    }
    finally {
      await resetViewport()
    }
  })

  it('is a 44 px target at a coarse pointer', async () => {
    const screen = await mountTabs('/devices/kitchen')
    const link = screen.getByRole('link', { name: 'Settings' }).element()

    await withCoarsePointer(async () => {
      expect(link.getBoundingClientRect().height).toBe(44)
    })
  })

  it('is accessible and does not overflow in every state', async () => {
    const screen = await mount(TabsGallery)

    await expect.element(screen.getByRole('link', { name: 'Screens' })).toHaveAttribute('aria-current', 'page')
    await expectAccessible()
    await expectNoHorizontalOverflow()
  })
})
