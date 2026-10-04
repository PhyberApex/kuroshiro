import type { NavItem } from './navItem'
import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { mountPage } from '@/testing/mount'
import { expectScreenshot } from '@/testing/screenshots'
import { THEMES } from '@/testing/theme'
import { resetViewport, resizeTo, VIEWPORTS } from '@/testing/viewport'
import PageList from './PageList.vue'

const PAGES: NavItem[] = [
  { label: 'Instance Settings', to: '/instance/settings' },
  { label: 'Firmware', to: '/instance/firmware' },
  { label: 'Device Models and Palettes', to: '/instance/models' },
  { label: 'Configuration Archive', to: '/instance/archive' },
  { label: 'Housekeeping', to: '/instance/housekeeping' },
  { label: 'Device Simulator', to: '/instance/simulator' },
]

const InstanceFrame = defineComponent(() => () => h(PageList, { label: 'Instance', items: PAGES }))

// The gallery is shot at desktop width, where the page list is a column; the row it becomes below 820 px is shot here.
describe('page list baselines', () => {
  it.for(THEMES)('the row on a phone in %s', async (theme) => {
    await resizeTo(VIEWPORTS.phone.width, VIEWPORTS.phone.height)
    try {
      const screen = await mountPage({
        routes: PAGES.map(page => ({ path: page.to as string, component: InstanceFrame })),
        at: '/instance/simulator',
        theme,
      })
      const nav = screen.getByRole('navigation', { name: 'Instance' })
      await expect.element(nav.getByRole('link', { name: 'Device Simulator' })).toHaveAttribute('aria-current', 'page')

      await expectScreenshot(nav, `page-list-row-${theme}`)
    }
    finally {
      await resetViewport()
    }
  })
})
