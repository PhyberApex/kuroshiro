import type { IconName } from '../icons'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { expectAccessible } from '@/testing/a11y'
import { mount } from '@/testing/mount'
import { expectNoHorizontalOverflow } from '@/testing/overflow'
import IconGallery from '../Icon.gallery.vue'
import Icon from '../Icon.vue'
import { ICON_NAMES } from '../icons'

const THE_THIRTEEN = ['grip', 'chevron', 'up', 'down', 'close', 'check', 'plus', 'copy', 'external', 'search', 'upload', 'problem', 'more'] as const

describe('icon', () => {
  it('is one of exactly thirteen', () => {
    expect(ICON_NAMES).toEqual(THE_THIRTEEN)
    expectTypeOf<IconName>().toEqualTypeOf<typeof THE_THIRTEEN[number]>()
  })

  it('is decorative unless it is given a label', async () => {
    const screen = await mount(Icon, { props: { name: 'problem' } })

    expect(screen.container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    await expect.element(screen.getByRole('img')).not.toBeInTheDocument()
  })

  it('is an image with that name when it is given a label', async () => {
    const screen = await mount(Icon, { props: { name: 'problem', label: 'Problem' } })

    await expect.element(screen.getByRole('img', { name: 'Problem' })).toBeVisible()
  })

  it('takes the colour of the text around it', async () => {
    const screen = await mount(Icon, { props: { name: 'check' }, theme: 'dark' })

    expect(getComputedStyle(screen.container.querySelector('svg')!).fill).toBe('rgb(244, 244, 244)')
  })

  it('shows each of the thirteen at 16 px in the gallery', async () => {
    const screen = await mount(IconGallery)

    const icons = [...screen.container.querySelectorAll('svg')]
    expect(icons).toHaveLength(13)
    icons.forEach((icon) => {
      const { width, height } = icon.getBoundingClientRect()
      expect([width, height]).toEqual([16, 16])
    })
    await Promise.all(THE_THIRTEEN.map(name => expect.element(screen.getByText(name, { exact: true })).toBeVisible()))
  })

  it('is accessible and does not overflow', async () => {
    await mount(IconGallery)

    await expectAccessible()
    await expectNoHorizontalOverflow()
  })
})
