import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { expectAccessible } from '@/testing/a11y'
import { mount } from '@/testing/mount'
import { expectNoHorizontalOverflow } from '@/testing/overflow'
import { resetViewport, resizeTo } from '@/testing/viewport'
import EditorBenchGallery from '../EditorBench.gallery.vue'
import EditorBench from '../EditorBench.vue'

const part = (testid: string, style = '') => h('div', { 'data-testid': testid, style })

function bench(props: { fullWindow?: boolean } = {}, underPlateHeight = 40) {
  return defineComponent(() => () => h('div', { 'style': 'height: 500px', 'data-testid': 'place' }, h(EditorBench, props, {
    editor: () => part('editor', 'height: 100%; min-height: 100px'),
    plate: () => part('plate', 'height: 200px'),
    default: () => part('under', `height: ${underPlateHeight}px`),
  })))
}

async function mountBench(...args: Parameters<typeof bench>) {
  const screen = await mount(bench(...args))
  const box = (testid: string) => screen.getByTestId(testid).element().getBoundingClientRect()
  return { screen, box }
}

describe('editor bench', () => {
  it('gives the editor 6 parts of 11 and the preview the rest, 24 px apart', async () => {
    const { box } = await mountBench()
    const whole = box('place').width
    const editor = box('editor')
    const plate = box('plate')

    expect(editor.width).toBeCloseTo((whole - 24) * 6 / 11, 0)
    expect(plate.left - editor.right).toBeCloseTo(24 + 2, 0)
    expect(plate.right).toBeCloseTo(box('place').right - 2, 0)
    expect(box('under').top).toBe(plate.bottom)
  })

  it('stacks below 820 px, the editor first', async () => {
    const { box } = await mountBench()

    await resizeTo(768)
    try {
      expect(box('editor').width).toBe(box('place').width)
      expect(box('plate').top).toBeGreaterThan(box('editor').bottom)
      expect(box('under').top).toBe(box('plate').bottom)
    }
    finally {
      await resetViewport()
    }
  })

  it('fills the height in the full window, the preview column 40% wide', async () => {
    const { box } = await mountBench({ fullWindow: true })
    const whole = box('place')

    expect(box('editor').height).toBe(500)
    expect(box('plate').width + 4).toBeCloseTo(whole.width * 0.4, 0)
    expect(box('editor').width).toBeCloseTo(whole.width * 0.6 - 24, 0)
  })

  it('keeps the preview column at 22 rem or more in the full window', async () => {
    const { box } = await mountBench({ fullWindow: true })

    await resizeTo(830)
    try {
      expect(box('plate').width + 4).toBe(22 * 16)
    }
    finally {
      await resetViewport()
    }
  })

  it('scrolls the preview column by itself in the full window', async () => {
    const { screen, box } = await mountBench({ fullWindow: true }, 900)
    const column = screen.getByTestId('plate').element().parentElement!

    expect(box('editor').height).toBe(500)
    expect(column.clientHeight).toBe(500)
    expect(column.scrollHeight).toBeGreaterThan(900)
    expect(getComputedStyle(column).overflowY).toBe('auto')
  })

  it('is accessible and does not overflow in every state', async () => {
    const screen = await mount(EditorBenchGallery)
    await expect.poll(() => screen.container.querySelectorAll('[aria-busy]').length).toBe(0)

    await expectAccessible()
    await expectNoHorizontalOverflow()
  })
})
