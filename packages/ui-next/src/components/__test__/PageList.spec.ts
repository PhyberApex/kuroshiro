import type { NavItem } from '../navItem'
import { describe, expect, it } from 'vitest'
import { userEvent } from 'vitest/browser'
import { defineComponent, h } from 'vue'
import { expectAccessible } from '@/testing/a11y'
import { withCoarsePointer } from '@/testing/media'
import { mount, mountPage } from '@/testing/mount'
import { expectNoHorizontalOverflow } from '@/testing/overflow'
import { resetViewport, resizeTo } from '@/testing/viewport'
import PageListGallery from '../PageList.gallery.vue'
import PageList from '../PageList.vue'

const PAGES: NavItem[] = [
  { label: 'Instance Settings', to: '/instance/settings' },
  { label: 'Firmware', to: '/instance/firmware' },
  { label: 'Device Models and Palettes', to: '/instance/models' },
  { label: 'Configuration Archive', to: '/instance/archive' },
  { label: 'Housekeeping', to: '/instance/housekeeping' },
  { label: 'Device Simulator', to: '/instance/simulator' },
]

const InstanceFrame = defineComponent(() => () => h(PageList, { label: 'Instance', items: PAGES }))

function mountList(at: string) {
  return mountPage({
    routes: PAGES.map(page => ({ path: page.to as string, component: InstanceFrame })),
    at,
  })
}

function isInView(link: Element, frame: Element) {
  const { left, right } = link.getBoundingClientRect()
  const bounds = frame.getBoundingClientRect()
  return left >= bounds.left && right <= bounds.right
}

async function onPhone<T>(body: () => Promise<T>) {
  await resizeTo(375)
  try {
    return await body()
  }
  finally {
    await resetViewport()
  }
}

describe('page list', () => {
  it('is a named navigation holding a list of links, one per page, in order', async () => {
    const screen = await mountList('/instance/settings')
    const nav = screen.getByRole('navigation', { name: 'Instance' })

    expect(nav.getByRole('list').getByRole('listitem').elements()).toHaveLength(6)
    expect(nav.getByRole('link').elements().map(link => link.textContent?.trim())).toEqual(PAGES.map(page => page.label))
    await expect.element(nav.getByRole('link', { name: 'Firmware' })).toHaveAttribute('href', '/instance/firmware')
  })

  it('marks the link of the current route as the current page, and follows the route', async () => {
    const screen = await mountList('/instance/firmware')

    await expect.element(screen.getByRole('link', { name: 'Firmware' })).toHaveAttribute('aria-current', 'page')
    expect(screen.container.querySelectorAll('[aria-current]')).toHaveLength(1)

    await screen.router.push('/instance/housekeeping')

    await expect.element(screen.getByRole('link', { name: 'Housekeeping' })).toHaveAttribute('aria-current', 'page')
    await expect.element(screen.getByRole('link', { name: 'Firmware' })).not.toHaveAttribute('aria-current')
  })

  it('is a column with the current page in solid ink', async () => {
    const screen = await mountList('/instance/firmware')
    const current = screen.getByRole('link', { name: 'Firmware' }).element()
    const tops = screen.getByRole('link').elements().map(link => link.getBoundingClientRect().top)

    expect(new Set(tops).size).toBe(6)
    await expect.poll(() => getComputedStyle(current).backgroundColor).toBe(getComputedStyle(document.body).color)
    expect(getComputedStyle(current).color).toBe(getComputedStyle(document.body).backgroundColor)
  })

  it('reaches every link with Tab and opens one with Enter', async () => {
    const screen = await mountList('/instance/settings')

    for (const page of PAGES) {
      await userEvent.keyboard('{Tab}')
      await expect.element(screen.getByRole('link', { name: page.label })).toHaveFocus()
    }

    await userEvent.keyboard('{Enter}')

    await expect.element(screen.getByRole('link', { name: 'Device Simulator' })).toHaveAttribute('aria-current', 'page')
    expect(screen.router.currentRoute.value.path).toBe('/instance/simulator')
  })

  it('is one sideways-scrolling row at 375 px that does not widen the page', async () => {
    const screen = await mountList('/instance/settings')

    await onPhone(async () => {
      const nav = screen.getByRole('navigation', { name: 'Instance' }).element()
      const tops = screen.getByRole('link').elements().map(link => link.getBoundingClientRect().top)

      expect(new Set(tops).size).toBe(1)
      expect(nav.scrollWidth).toBeGreaterThan(nav.clientWidth)
      expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(document.documentElement.clientWidth)
    })
  })

  it('underlines the current page in the row instead of filling it', async () => {
    const screen = await mountList('/instance/settings')

    await onPhone(async () => {
      const current = screen.getByRole('link', { name: 'Instance Settings' }).element()

      expect(getComputedStyle(current).backgroundColor).toBe('rgba(0, 0, 0, 0)')
      expect(getComputedStyle(current).boxShadow).toContain('inset')
    })
  })

  it('scrolls the current page into view in the row, when it opens and when the route changes', async () => {
    await resizeTo(375)
    try {
      const screen = await mountList('/instance/simulator')
      const nav = screen.getByRole('navigation', { name: 'Instance' }).element()

      await expect.poll(() => isInView(screen.getByRole('link', { name: 'Device Simulator' }).element(), nav)).toBe(true)
      expect(isInView(screen.getByRole('link', { name: 'Instance Settings' }).element(), nav)).toBe(false)

      await screen.router.push('/instance/settings')

      await expect.poll(() => isInView(screen.getByRole('link', { name: 'Instance Settings' }).element(), nav)).toBe(true)
    }
    finally {
      await resetViewport()
    }
  })

  it('is a 44 px target at a coarse pointer, and in the row', async () => {
    const screen = await mountList('/instance/settings')
    const link = screen.getByRole('link', { name: 'Firmware' }).element()

    await withCoarsePointer(async () => {
      expect(link.getBoundingClientRect().height).toBe(44)
    })
    await onPhone(async () => {
      expect(link.getBoundingClientRect().height).toBe(44)
    })
  })

  it('is accessible and does not overflow in every state', async () => {
    const screen = await mount(PageListGallery)

    await expect.element(screen.getByRole('link', { name: 'Instance Settings' })).toHaveAttribute('aria-current', 'page')
    await expectAccessible()
    await expectNoHorizontalOverflow()
  })
})
