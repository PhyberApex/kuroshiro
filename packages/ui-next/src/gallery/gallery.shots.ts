import { describe, expect, it } from 'vitest'
import { mount } from '@/testing/mount'
import { expectScreenshot } from '@/testing/screenshots'
import { THEMES } from '@/testing/theme'
import GalleryPage from './GalleryPage.vue'
import { sections } from './sections'

describe('gallery baselines', () => {
  const shots = sections.flatMap(section => THEMES.map(theme => ({ section, theme })))

  it.for(shots)('$section.title in $theme', async ({ section, theme }) => {
    const screen = await mount(GalleryPage, { theme })
    // A code editor is fetched and a preview is drawn in a frame, and the `div` of each is busy while that lasts. A button or a switch that is busy is a state the gallery holds.
    await expect.poll(() => screen.container.querySelectorAll('div[aria-busy="true"]').length).toBe(0)

    await expectScreenshot(screen.getByRole('region', { name: section.title, exact: true }), `${section.id}-${theme}`)
  })
})
