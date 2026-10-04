import { describe, expect, it } from 'vitest'
import { expectAccessible } from '@/testing/a11y'
import { mount } from '@/testing/mount'
import { expectNoHorizontalOverflow } from '@/testing/overflow'
import EmptyPlateGallery from '../EmptyPlate.gallery.vue'
import EmptyPlate from '../EmptyPlate.vue'

const plateOf = (container: Element) => container.querySelector<HTMLElement>('.empty-plate')!

function washColour() {
  const probe = document.createElement('div')
  probe.style.background = 'var(--color-wash)'
  document.body.append(probe)
  const colour = getComputedStyle(probe).backgroundColor
  probe.remove()
  return colour
}

describe('the empty plate', () => {
  it('says what is not there yet', async () => {
    const screen = await mount(EmptyPlate, { slots: { default: () => 'Nothing polled yet' } })

    await expect.element(screen.getByText('Nothing polled yet')).toBeVisible()
  })

  it('is drawn on wash inside a 1 px dashed border', async () => {
    const screen = await mount(EmptyPlate, { slots: { default: () => 'Nothing polled yet' } })
    const style = getComputedStyle(plateOf(screen.container))

    expect(style.outlineStyle).toBe('dashed')
    expect(style.outlineWidth).toBe('1px')
    expect(style.backgroundColor).toBe(washColour())
  })

  it('takes the shape of the panel it stands in for, and the TRMNL OG\'s without one', async () => {
    const screen = await mount(EmptyPlate, { props: { width: 1872, height: 1404 }, slots: { default: () => 'Nothing polled yet' } })
    expect(plateOf(screen.container).style.aspectRatio).toBe('1872 / 1404')

    const unsized = await mount(EmptyPlate, { slots: { default: () => 'Nothing polled yet' } })
    expect(plateOf(unsized.container).style.aspectRatio).toBe('800 / 480')
  })

  it('is accessible and does not overflow', async () => {
    await mount(EmptyPlateGallery)

    await expectAccessible()
    await expectNoHorizontalOverflow()
  })
})
