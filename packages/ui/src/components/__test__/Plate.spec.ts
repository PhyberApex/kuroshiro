import { describe, expect, it } from 'vitest'
import { h } from 'vue'
import { expectAccessible } from '@/testing/a11y'
import { withMotionAllowed } from '@/testing/media'
import { mount } from '@/testing/mount'
import { expectNoHorizontalOverflow } from '@/testing/overflow'
import { elementsInSealColour } from '@/testing/sealColour'
import { resetViewport, resizeTo } from '@/testing/viewport'
import PlateGallery from '../Plate.gallery.vue'
import Plate from '../Plate.vue'

function imageOf(width: number, height: number) {
  const canvas = Object.assign(document.createElement('canvas'), { width, height })
  canvas.getContext('2d')!.fillRect(0, 0, width / 2, height)
  return canvas.toDataURL('image/png')
}

const NAME = 'On Kitchen: Calendar'

const frameOf = (container: Element) => container.firstElementChild as HTMLElement
const ratioOf = (element: Element) => element.getBoundingClientRect().width / element.getBoundingClientRect().height

describe('plate', () => {
  it('shows the Screen image under its name, on the plate ground in a 2 px ink outline with a 2 px radius', async () => {
    const screen = await mount(Plate, { props: { name: NAME, src: imageOf(800, 480) }, theme: 'dark' })

    await expect.element(screen.getByRole('img', { name: NAME })).toBeVisible()
    expect(screen.getByRole('img').element()).toHaveAttribute('src', expect.stringContaining('data:image/png'))
    const frame = getComputedStyle(frameOf(screen.container))
    expect(frame.backgroundColor).toBe('rgb(255, 255, 255)')
    expect([frame.outlineWidth, frame.outlineStyle, frame.outlineColor]).toEqual(['2px', 'solid', 'rgb(244, 244, 244)'])
    expect(frame.borderRadius).toBe('2px')
  })

  it.for(['', '   '])('cannot be mounted without a name (%j)', async (name) => {
    await expect(mount(Plate, { props: { name, src: imageOf(800, 480) } }))
      .rejects
      .toThrow('A Plate needs a name')
  })

  it.for([
    { panel: 'landscape', width: 800, height: 480 },
    { panel: 'portrait', width: 480, height: 800 },
    { panel: '64 × 32', width: 64, height: 32 },
  ])('keeps the ratio of a $panel image', async ({ width, height }) => {
    const screen = await mount(Plate, { props: { name: NAME, src: imageOf(width, height), size: 'list' } })
    const frame = frameOf(screen.container)

    await expect.poll(() => ratioOf(frame)).toBeCloseTo(width / height, 2)
    expect(frame.getBoundingClientRect().width).toBe(168)
    expect(ratioOf(screen.getByRole('img').element())).toBeCloseTo(width / height, 2)
  })

  it('has the shape of the Device Model before there is an image', async () => {
    const screen = await mount(Plate, { props: { name: NAME, size: 'list', width: 480, height: 800 } })

    expect(ratioOf(frameOf(screen.container))).toBeCloseTo(480 / 800, 2)
  })

  it('is 576 px as the Current Screen, 168 px in a list and 72 px in a row, and fills its place as a preview', async () => {
    const widthAt = async (size: string) => {
      const screen = await mount(Plate, { props: { name: NAME, size, rendering: true } })
      return frameOf(screen.container).getBoundingClientRect().width
    }

    expect(await widthAt('current')).toBe(576)
    expect(await widthAt('list')).toBe(168)
    expect(await widthAt('row')).toBe(72)
    expect(await widthAt('preview')).toBe(document.body.clientWidth)
  })

  it('is 112 px in a list and still 72 px in a row on a phone, where the Current Screen takes the width there is', async () => {
    const list = await mount(Plate, { props: { name: NAME, size: 'list', rendering: true } })
    const row = await mount(Plate, { props: { name: NAME, size: 'row', rendering: true } })
    const current = await mount(Plate, { props: { name: NAME, size: 'current', rendering: true } })

    await resizeTo(375)
    try {
      expect(frameOf(list.container).getBoundingClientRect().width).toBe(112)
      expect(frameOf(row.container).getBoundingClientRect().width).toBe(72)
      expect(frameOf(current.container).getBoundingClientRect().width).toBe(document.body.clientWidth)
    }
    finally {
      await resetViewport()
    }
  })

  it('wears the red seal only when it is sealed, and nothing else on it is red', async () => {
    const plain = await mount(Plate, { props: { name: NAME, src: imageOf(800, 480) } })
    expect(plain.container.querySelector('svg')).toBeNull()
    expect(elementsInSealColour(plain.container)).toEqual([])

    const sealed = await mount(Plate, { props: { name: NAME, src: imageOf(800, 480), size: 'current', sealed: true } })
    const seal = sealed.container.querySelector('svg')!
    expect(seal).toHaveAttribute('aria-hidden', 'true')
    // The computed width, not the bounding rect: the seal's tilt widens its rotated bounding box.
    expect(getComputedStyle(seal).width).toBe('56px')
    expect(getComputedStyle(seal.querySelector('path')!).fill).toBe('rgb(255, 255, 255)')
    const red = elementsInSealColour(sealed.container)
    expect(red).toContain(seal)
    expect(red.every(element => seal.contains(element))).toBe(true)
  })

  it('tilts the seal 4 degrees askew, as a hand-pressed hanko would', async () => {
    const screen = await mount(Plate, { props: { name: NAME, src: imageOf(800, 480), sealed: true } })

    expect(getComputedStyle(screen.container.querySelector('.mark')!).rotate).toBe('-4deg')
  })

  it('wears the small seal, 白 alone, as a row thumbnail', async () => {
    const screen = await mount(Plate, { props: { name: NAME, src: imageOf(800, 480), size: 'row', sealed: true } })

    expect(screen.container.querySelector('svg')).toHaveAttribute('viewBox', '0 0 16 16')
  })

  it('stamps the seal when what it marks changes, not when it first appears', async () => {
    const screen = await mount(Plate, { props: { name: NAME, src: imageOf(800, 480), sealed: true, stampKey: 'calendar' } })
    const animationOfSeal = () => getComputedStyle(screen.container.querySelector('svg')!).animationName

    await withMotionAllowed(async () => {
      expect(animationOfSeal()).toBe('none')

      await screen.rerender({ stampKey: 'weather' })

      await expect.poll(animationOfSeal).not.toBe('none')
    })
    expect(animationOfSeal()).toBe('none')
  })

  it('dims the image of a Screen Rotation passes over', async () => {
    const screen = await mount(Plate, { props: { name: NAME, src: imageOf(800, 480), passedOver: true } })

    await expect.element(screen.getByRole('img', { name: NAME })).toHaveStyle({ opacity: '0.45' })
  })

  it('shows the dither and the loading mark, no spinner, while the image is rendering', async () => {
    const screen = await mount(Plate, { props: { name: NAME, rendering: true, src: imageOf(800, 480) } })
    const frame = frameOf(screen.container)

    await expect.element(screen.getByRole('img', { name: `${NAME}: rendering` })).toBeVisible()
    expect(frame.querySelector('img')).toBeNull()
    expect(getComputedStyle(frame).backgroundImage).toContain('repeating-conic-gradient')
    expect(getComputedStyle(frame).backgroundSize).toBe('4px 4px')
    await expect.element(screen.getByText('Rendering')).toBeVisible()
    await withMotionAllowed(async () => {
      const moving = [frame, ...frame.querySelectorAll('*')].filter(element => getComputedStyle(element).animationName !== 'none')
      expect(moving).toHaveLength(1)
      expect(getComputedStyle(moving[0]).animationTimingFunction).toBe('steps(1)')
      expect(moving[0].getBoundingClientRect()).toMatchObject({ width: 8, height: 8 })
    })
  })

  it('says what it is waiting for when it is told', async () => {
    const screen = await mount(Plate, { props: { name: NAME, rendering: true, renderingNote: 'Fetching the data' } })

    await expect.element(screen.getByRole('img', { name: `${NAME}: fetching the data` })).toBeVisible()
    await expect.element(screen.getByText('Fetching the data')).toBeVisible()
    expect(screen.getByText('Rendering').elements()).toEqual([])
  })

  it('is rendering for as long as it has no image', async () => {
    const screen = await mount(Plate, { props: { name: NAME, src: null, size: 'row' } })

    await expect.element(screen.getByRole('img', { name: `${NAME}: rendering` })).toBeVisible()
    await expect.element(screen.getByText('Rendering')).not.toBeVisible()
  })

  it('shows the error state when told to, and by itself when the image cannot be loaded', async () => {
    const told = await mount(Plate, { props: { name: NAME, failed: true, src: imageOf(800, 480) } })
    await expect.element(told.getByRole('img', { name: `${NAME}: no image yet` })).toBeVisible()
    await expect.element(told.getByText('No image yet')).toBeVisible()
    expect(elementsInSealColour(told.container)).toEqual([])

    const broken = await mount(Plate, { props: { name: 'Photo', src: 'data:image/png;base64,AAAA' } })
    await expect.element(broken.getByRole('img', { name: 'Photo: no image yet' })).toBeVisible()

    await broken.rerender({ src: imageOf(800, 480) })
    await expect.element(broken.getByRole('img', { name: 'Photo', exact: true })).toBeVisible()
  })

  it('takes the shape of a new image when its image changes', async () => {
    const screen = await mount(Plate, { props: { name: NAME, src: imageOf(800, 480), size: 'list' } })
    await expect.poll(() => ratioOf(frameOf(screen.container))).toBeCloseTo(800 / 480, 2)

    await screen.rerender({ src: imageOf(480, 800) })

    await expect.poll(() => ratioOf(frameOf(screen.container))).toBeCloseTo(480 / 800, 2)
  })

  it('loads lazily when asked to', async () => {
    const eager = await mount(Plate, { props: { name: NAME, src: imageOf(800, 480) } })
    expect(eager.getByRole('img').element()).not.toHaveAttribute('loading')

    const lazy = await mount(Plate, { props: { name: 'Weather', src: imageOf(800, 480), lazy: true } })
    expect(lazy.getByRole('img', { name: 'Weather' }).element()).toHaveAttribute('loading', 'lazy')
  })

  it('holds what its default slot gives it in place of the image, under the same name', async () => {
    const screen = await mount(Plate, {
      props: { name: 'Preview of Weather', src: imageOf(800, 480), width: 800, height: 480 },
      slots: { default: () => h('button', 'Render again') },
    })

    const frame = screen.getByRole('group', { name: 'Preview of Weather' })
    await expect.element(frame.getByRole('button', { name: 'Render again' })).toBeVisible()
    expect(frame.element().querySelector('img')).toBeNull()
    expect(ratioOf(frame.element())).toBeCloseTo(800 / 480, 2)
  })

  it('is accessible and does not overflow in every state', async () => {
    await mount(PlateGallery)

    await expectAccessible()
    await expectNoHorizontalOverflow()
  })
})
