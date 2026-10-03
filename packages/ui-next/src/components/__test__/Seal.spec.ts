import { describe, expect, it } from 'vitest'
import { expectAccessible } from '@/testing/a11y'
import { withMotionAllowed } from '@/testing/media'
import { mount } from '@/testing/mount'
import { expectNoHorizontalOverflow } from '@/testing/overflow'
import { elementsInSealColour } from '@/testing/sealColour'
import SealGallery from '../Seal.gallery.vue'
import Seal from '../Seal.vue'

const WHITE_ALONE = 'M6 2h2v2H6zM3 4h10v10H3zM5 6v2h6V6zM5 10v2h6v-2z'

async function mountSeal(props: object = {}) {
  const screen = await mount(Seal, { props })
  const seal = screen.container.querySelector('svg')!
  return { screen, seal, characters: seal.querySelector('path')! }
}

describe('seal', () => {
  it('draws 黒白 on the 64 px grid at 24 px', async () => {
    const { seal, characters } = await mountSeal({ size: 24 })

    expect(seal.getAttribute('viewBox')).toBe('0 0 64 64')
    expect(characters.getAttribute('d')).not.toBe(WHITE_ALONE)
    expect(seal.getBoundingClientRect()).toMatchObject({ width: 24, height: 24 })
  })

  it('still draws 黒白 at 20 px, the smallest it is legible at', async () => {
    const { seal } = await mountSeal({ size: 20 })

    expect(seal.getAttribute('viewBox')).toBe('0 0 64 64')
  })

  it.for([16, 12])('draws 白 alone on the 16 px grid at %i px', async (size) => {
    const { seal, characters } = await mountSeal({ size })

    expect(seal.getAttribute('viewBox')).toBe('0 0 16 16')
    expect(characters.getAttribute('d')).toBe(WHITE_ALONE)
    expect(seal.getBoundingClientRect()).toMatchObject({ width: size, height: size })
  })

  it('is an outline: it holds no text, so no face is loaded for it', async () => {
    const facesBefore = [...document.fonts].filter(face => face.status === 'loaded').map(face => face.family)
    const { seal } = await mountSeal({ size: 64 })
    await document.fonts.ready

    expect(seal.querySelector('text')).toBeNull()
    expect(seal.textContent).toBe('')
    expect([...document.fonts].filter(face => face.status === 'loaded').map(face => face.family)).toEqual(facesBefore)
  })

  it('is vermilion unless it is asked for in ink', async () => {
    const red = await mountSeal()
    expect(elementsInSealColour(red.screen.container)).toContain(red.seal)

    const ink = await mountSeal({ colour: 'ink' })
    expect(elementsInSealColour(ink.screen.container)).toEqual([])
    expect(getComputedStyle(ink.seal).fill).toBe('rgb(18, 18, 18)')
  })

  it('cuts its characters in the colour of the ground it sits on', async () => {
    const { seal, characters } = await mountSeal()
    expect(getComputedStyle(characters).fill).toBe('rgb(255, 255, 255)')

    seal.parentElement!.style.setProperty('--seal-ground', 'rgb(1, 2, 3)')

    await expect.poll(() => getComputedStyle(characters).fill).toBe('rgb(1, 2, 3)')
  })

  it('is decorative unless it is given a label', async () => {
    const { seal } = await mountSeal()
    expect(seal).toHaveAttribute('aria-hidden', 'true')

    const named = await mount(Seal, { props: { label: 'Kuroshiro' } })
    await expect.element(named.getByRole('img', { name: 'Kuroshiro' })).toBeVisible()
  })

  it('stamps once in 200 ms, and not at all where motion is reduced', async () => {
    const { seal } = await mountSeal({ stamps: true })
    expect(getComputedStyle(seal).animationName).toBe('none')

    await withMotionAllowed(async () => {
      expect(getComputedStyle(seal).animationName).not.toBe('none')
      expect(getComputedStyle(seal).animationDuration).toBe('0.2s')
      expect(getComputedStyle(seal).animationIterationCount).toBe('1')
    })
  })

  it('does not stamp unless asked to', async () => {
    const { seal } = await mountSeal()

    await withMotionAllowed(async () => {
      expect(getComputedStyle(seal).animationName).toBe('none')
    })
  })

  it('is accessible and does not overflow in every size', async () => {
    await mount(SealGallery)

    await expectAccessible()
    await expectNoHorizontalOverflow()
  })
})
