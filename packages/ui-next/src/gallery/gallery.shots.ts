import { describe, it } from 'vitest'
import { mount } from '@/testing/mount'
import { expectScreenshot } from '@/testing/screenshots'
import { THEMES } from '@/testing/theme'
import GalleryPage from './GalleryPage.vue'
import { sections } from './sections'

describe('gallery baselines', () => {
  const shots = sections.flatMap(section => THEMES.map(theme => ({ section, theme })))

  it.for(shots)('$section.title in $theme', async ({ section, theme }) => {
    const screen = await mount(GalleryPage, { theme })

    await expectScreenshot(screen.getByRole('region', { name: section.title }), `${section.id}-${theme}`)
  })
})
