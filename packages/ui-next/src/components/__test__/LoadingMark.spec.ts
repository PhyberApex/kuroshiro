import { describe, expect, it } from 'vitest'
import { expectAccessible } from '@/testing/a11y'
import { withMotionAllowed } from '@/testing/media'
import { mount } from '@/testing/mount'
import { expectNoHorizontalOverflow } from '@/testing/overflow'
import LoadingMarkGallery from '../LoadingMark.gallery.vue'
import LoadingMark from '../LoadingMark.vue'

function animationOf(element: Element) {
  const { animationName, animationIterationCount, animationTimingFunction } = getComputedStyle(element)
  return { animationName, animationIterationCount, animationTimingFunction }
}

describe('the loading mark', () => {
  it('is an 8 px square of ink', async () => {
    const screen = await mount(LoadingMark)
    const mark = screen.getByRole('img', { name: 'Loading' }).element()

    const { width, height } = mark.getBoundingClientRect()
    expect([width, height]).toEqual([8, 8])
    expect(getComputedStyle(mark).backgroundColor).toBe('rgb(18, 18, 18)')
  })

  it('says what is loading when it is told', async () => {
    const screen = await mount(LoadingMark, { props: { label: 'Loading Kitchen\'s Screens' } })

    await expect.element(screen.getByRole('img', { name: 'Loading Kitchen\'s Screens' })).toBeVisible()
  })

  it('is hidden from assistive technology beside text that already says it', async () => {
    const screen = await mount(LoadingMark, { props: { decorative: true } })

    await expect.element(screen.getByRole('img')).not.toBeInTheDocument()
    expect(screen.container.firstElementChild).toHaveAttribute('aria-hidden', 'true')
  })

  it('blinks in steps, without end', async () => {
    const screen = await mount(LoadingMark)
    const mark = screen.getByRole('img', { name: 'Loading' }).element()

    await withMotionAllowed(async () => {
      const animation = animationOf(mark)
      expect(animation.animationName).not.toBe('none')
      expect(animation.animationIterationCount).toBe('infinite')
      expect(animation.animationTimingFunction).toMatch(/^steps\(1/)
    })
  })

  it('does not animate under reduced motion and leaves the square', async () => {
    const screen = await mount(LoadingMark)
    const mark = screen.getByRole('img', { name: 'Loading' }).element()

    expect(matchMedia('(prefers-reduced-motion: reduce)').matches).toBe(true)
    expect(animationOf(mark).animationName).toBe('none')
    expect(mark.getAnimations()).toHaveLength(0)
    expect(getComputedStyle(mark).opacity).toBe('1')
  })

  it('is accessible and does not overflow', async () => {
    await mount(LoadingMarkGallery)

    await expectAccessible()
    await expectNoHorizontalOverflow()
  })
})
