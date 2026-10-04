import { describe, it } from 'vitest'
import { page } from 'vitest/browser'
import { mount } from '@/testing/mount'
import { expectScreenshot } from '@/testing/screenshots'
import { THEMES } from '@/testing/theme'
import { resetViewport, resizeTo, VIEWPORTS } from '@/testing/viewport'
import ScreenRowGallery from './ScreenRow.gallery.vue'

// The gallery is shot at desktop width, where a row has its grip and its Order; the two move buttons and the stacked cells it has below 820 px are shot here.
describe('screen row baselines', () => {
  it.for(THEMES)('every look on a phone in %s', async (theme) => {
    await resizeTo(VIEWPORTS.phone.width, VIEWPORTS.phone.height)
    try {
      const screen = await mount(ScreenRowGallery, { theme })

      await expectScreenshot(page.elementLocator(screen.container), `screen-row-phone-${theme}`)
    }
    finally {
      await resetViewport()
    }
  })
})
