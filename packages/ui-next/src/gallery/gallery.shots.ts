import { describe, it } from 'vitest'
import { arrived } from '@/testing/arrivals'
import { mount } from '@/testing/mount'
import { expectScreenshot } from '@/testing/screenshots'
import { THEMES } from '@/testing/theme'
import GalleryPage from './GalleryPage.vue'
import { sections } from './sections'

describe('gallery baselines', () => {
  const shots = sections.flatMap(section => THEMES.map(theme => ({ section, theme })))

  it.for(shots)('$section.title in $theme', async ({ section, theme }) => {
    const screen = await mount(GalleryPage, { theme })
    await arrived(screen.container)

    await expectScreenshot(screen.getByRole('region', { name: section.title, exact: true }), `${section.id}-${theme}`)
  })
})
