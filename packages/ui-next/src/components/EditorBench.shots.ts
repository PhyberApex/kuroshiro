import { describe, expect, it } from 'vitest'
import { arrived } from '@/testing/arrivals'
import { mount } from '@/testing/mount'
import { expectScreenshot } from '@/testing/screenshots'
import { THEMES } from '@/testing/theme'
import { resetViewport, resizeTo, VIEWPORTS } from '@/testing/viewport'
import EditorBenchGallery from './EditorBench.gallery.vue'

// The gallery is shot at desktop width, where the bench is two columns; the stack it becomes below 820 px is shot here.
describe('editor bench baselines', () => {
  it.for(THEMES)('stacked on a phone in %s', async (theme) => {
    await resizeTo(VIEWPORTS.phone.width, VIEWPORTS.phone.height)
    try {
      const screen = await mount(EditorBenchGallery, { theme })
      await arrived(screen.container)
      await expect.element(screen.getByRole('textbox', { name: 'Template of Weather on the bench' })).toBeVisible()

      await expectScreenshot(screen.getByRole('figure').first(), `editor-bench-phone-${theme}`)
    }
    finally {
      await resetViewport()
    }
  })
})
