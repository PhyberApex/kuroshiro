import { describe, expect, it } from 'vitest'
import { expectAccessible } from '@/testing/a11y'
import { mount } from '@/testing/mount'
import { expectNoHorizontalOverflow } from '@/testing/overflow'
import SwatchesGallery from '../Swatches.gallery.vue'
import Swatches from '../Swatches.vue'

const SOFT_RED = ['#111111', '#b53a30', '#f2f0ea']

const squaresOf = (container: Element) => [...container.querySelectorAll<HTMLElement>('.swatches > *')]

describe('swatches', () => {
  it('is one square per colour, in the order given, each filled with its colour', async () => {
    const screen = await mount(Swatches, { props: { colours: SOFT_RED } })

    expect(squaresOf(screen.container).map(square => getComputedStyle(square).backgroundColor))
      .toEqual(['rgb(17, 17, 17)', 'rgb(181, 58, 48)', 'rgb(242, 240, 234)'])
  })

  it('draws each square 14 px wide and high, inside a 1 px border', async () => {
    const screen = await mount(Swatches, { props: { colours: SOFT_RED } })
    const [square] = squaresOf(screen.container)

    await expect.poll(() => square!.getBoundingClientRect().width).toBe(14)
    expect(square!.getBoundingClientRect().height).toBe(14)
    expect(getComputedStyle(square!).borderTopWidth).toBe('1px')
  })

  it('is hidden from assistive technology, which reads the colours named beside it', async () => {
    const screen = await mount(Swatches, { props: { colours: SOFT_RED } })

    expect(screen.container.querySelector('.swatches')?.getAttribute('aria-hidden')).toBe('true')
  })

  it('is accessible and does not overflow', async () => {
    await mount(SwatchesGallery)

    await expectAccessible()
    await expectNoHorizontalOverflow()
  })
})
