import { describe, it } from 'vitest'
import { page } from 'vitest/browser'
import { mount } from '@/testing/mount'
import { expectScreenshot } from '@/testing/screenshots'
import { THEMES } from '@/testing/theme'
import { resetViewport, resizeTo, VIEWPORTS } from '@/testing/viewport'
import DataSourceRowGallery from './DataSourceRow.gallery.vue'

// The gallery is shot at desktop width, where a row is one line; the name, the line and the health stacked, as below 820 px, are shot here.
describe('data source row baselines', () => {
  it.for(THEMES)('every state on a phone in %s', async (theme) => {
    await resizeTo(VIEWPORTS.phone.width, VIEWPORTS.phone.height)
    try {
      const screen = await mount(DataSourceRowGallery, { theme })

      await expectScreenshot(page.elementLocator(screen.container), `data-source-row-phone-${theme}`)
    }
    finally {
      await resetViewport()
    }
  })
})
