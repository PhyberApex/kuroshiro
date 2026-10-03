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

  it('is accessible in both themes', async () => {
    await mount(GalleryPage)

    await expectAccessible()
  })

  it('does not overflow at phone, tablet or desktop width', async () => {
    await mount(GalleryPage)

    await expectNoHorizontalOverflow()
  })
})
