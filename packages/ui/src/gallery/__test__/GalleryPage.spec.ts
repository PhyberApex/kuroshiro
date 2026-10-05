import { describe, expect, it } from 'vitest'
import { expectAccessible } from '@/testing/a11y'
import { mount } from '@/testing/mount'
import { expectNoHorizontalOverflow } from '@/testing/overflow'
import GalleryPage from '../GalleryPage.vue'

describe('the gallery', () => {
  it('shows the tokens as its first section: colour, type scale and space', async () => {
    const screen = await mount(GalleryPage)

    const tokens = screen.getByRole('region', { name: 'Tokens' })
    await expect.element(tokens.getByRole('heading', { name: 'Colour' })).toBeVisible()
    await expect.element(tokens.getByRole('heading', { name: 'Type scale' })).toBeVisible()
    await expect.element(tokens.getByRole('heading', { name: 'Space' })).toBeVisible()
    await expect.element(tokens.getByText('--color-seal')).toBeVisible()
  })

  it('links to each section from its contents', async () => {
    const screen = await mount(GalleryPage)

    await expect.element(screen.getByRole('navigation', { name: 'Sections' }).getByRole('link', { name: 'Tokens' }))
      .toHaveAttribute('href', '#tokens')
  })

  // The page holds every primitive in every state, so axe has more to read with each one that lands; under coverage in CI, alongside the other packages' own coverage runs, it has run past 60 s.
  it('is accessible in both themes', { timeout: 120_000 }, async () => {
    await mount(GalleryPage)

    await expectAccessible()
  })

  it('does not overflow at phone, tablet or desktop width', async () => {
    await mount(GalleryPage)

    await expectNoHorizontalOverflow()
  })
})
