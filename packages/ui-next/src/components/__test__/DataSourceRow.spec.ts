import { describe, expect, it, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import { defineComponent, h, ref } from 'vue'
import { expectAccessible } from '@/testing/a11y'
import { withMotionAllowed } from '@/testing/media'
import { mount } from '@/testing/mount'
import { expectNoHorizontalOverflow } from '@/testing/overflow'
import { elementsInSealColour } from '@/testing/sealColour'
import { resetViewport, resizeTo } from '@/testing/viewport'
import DataSourceRowGallery from '../DataSourceRow.gallery.vue'
import DataSourceRow from '../DataSourceRow.vue'
import DataSourceRows from '../DataSourceRows.vue'

const SOURCES = [
  { name: 'forecast', what: 'GET api.open-meteo.com/v1/forecast' },
  { name: 'pollen', what: 'POST pollen.test/today' },
  { name: 'holidays', what: 'literal · a fixed value' },
]

function listOf({ removed = [] as string[], onPutBack = () => {} } = {}) {
  return defineComponent(() => {
    const open = ref<string>()
    return () => h(DataSourceRows, { 'open': open.value, 'onUpdate:open': (value?: string) => (open.value = value) }, () => SOURCES.map(source =>
      h(DataSourceRow, { value: source.name, name: source.name, what: source.what, removed: removed.includes(source.name) }, {
        health: () => removed.includes(source.name)
          ? h('button', { type: 'button', onClick: onPutBack }, `Put back ${source.name}`)
          : h('span', `Health of ${source.name}`),
        default: () => h('p', `Inside ${source.name}`),
      })))
  })
}

type Mounted = Awaited<ReturnType<typeof mount>>

const triggerOf = (screen: Mounted, name: string) => screen.getByRole('button', { name, exact: true })
const inside = (screen: Mounted, name: string) => screen.getByText(`Inside ${name}`)

describe('the Data Source row', () => {
  it('shows the name as a button in a heading, what the Data Source is and its health, closed', async () => {
    const screen = await mount(listOf())

    await expect.element(screen.getByRole('heading', { name: 'forecast', level: 3 })).toBeVisible()
    await expect.element(triggerOf(screen, 'forecast')).toHaveAttribute('aria-expanded', 'false')
    await expect.element(screen.getByText('GET api.open-meteo.com/v1/forecast')).toBeVisible()
    await expect.element(screen.getByText('Health of forecast')).toBeVisible()
    expect(inside(screen, 'forecast').elements()).toEqual([])
    expect(screen.getByRole('listitem').elements()).toHaveLength(3)
  })

  it('opens in place by its name, one row at a time, and closes again', async () => {
    const screen = await mount(listOf())

    await triggerOf(screen, 'forecast').click()
    await expect.element(inside(screen, 'forecast')).toBeVisible()
    await expect.element(triggerOf(screen, 'forecast')).toHaveAttribute('aria-expanded', 'true')
    await expect.element(screen.getByRole('region', { name: 'forecast' })).toBeVisible()

    await triggerOf(screen, 'pollen').click()
    await expect.element(inside(screen, 'pollen')).toBeVisible()
    await expect.poll(() => inside(screen, 'forecast').elements()).toEqual([])

    await triggerOf(screen, 'pollen').click()
    await expect.poll(() => inside(screen, 'pollen').elements()).toEqual([])
  })

  it('is opened and closed from the keyboard, and the arrow keys move between the rows', async () => {
    const screen = await mount(listOf())

    await userEvent.keyboard('{Tab}')
    await expect.element(triggerOf(screen, 'forecast')).toHaveFocus()

    await userEvent.keyboard('{Enter}')
    await expect.element(inside(screen, 'forecast')).toBeVisible()

    await userEvent.keyboard(' ')
    await expect.poll(() => inside(screen, 'forecast').elements()).toEqual([])

    await userEvent.keyboard('{ArrowDown}')
    await expect.element(triggerOf(screen, 'pollen')).toHaveFocus()
    await userEvent.keyboard('{ArrowUp}')
    await expect.element(triggerOf(screen, 'forecast')).toHaveFocus()
  })

  it('opens from anywhere on its line, and draws the focus ring around the line', async () => {
    const screen = await mount(listOf())

    await screen.getByText('POST pollen.test/today').click()
    await expect.element(inside(screen, 'pollen')).toBeVisible()

    await screen.getByText('Health of pollen').click()
    await expect.poll(() => inside(screen, 'pollen').elements()).toEqual([])

    await userEvent.keyboard('{Tab}')
    const line = document.activeElement!.closest('.line')!
    await expect.poll(() => getComputedStyle(line).outlineStyle).toBe('solid')
  })

  it('struck through and not to be opened once removed, while what its health holds still answers', async () => {
    const onPutBack = vi.fn()
    const screen = await mount(listOf({ removed: ['pollen'], onPutBack }))
    const name = triggerOf(screen, 'pollen')

    await expect.element(name).toBeDisabled()
    expect(getComputedStyle(name.element()).textDecorationLine).toBe('line-through')
    expect(getComputedStyle(screen.getByText('POST pollen.test/today').element()).textDecorationLine).toBe('line-through')
    expect(getComputedStyle(triggerOf(screen, 'forecast').element()).textDecorationLine).toBe('none')

    await screen.getByText('POST pollen.test/today').click()
    expect(inside(screen, 'pollen').elements()).toEqual([])

    await screen.getByRole('button', { name: 'Put back pollen' }).click()
    expect(onPutBack).toHaveBeenCalledOnce()
    expect(inside(screen, 'pollen').elements()).toEqual([])
  })

  it('stacks to the name, the line and the health on a phone', async () => {
    const screen = await mount(listOf())
    const top = (text: string) => screen.getByText(text).element().getBoundingClientRect().top

    expect(top('GET api.open-meteo.com/v1/forecast')).toBeLessThan(triggerOf(screen, 'forecast').element().getBoundingClientRect().bottom)

    await resizeTo(375)
    try {
      const nameBottom = triggerOf(screen, 'forecast').element().getBoundingClientRect().bottom
      expect(top('GET api.open-meteo.com/v1/forecast')).toBeGreaterThanOrEqual(nameBottom)
      expect(top('Health of forecast')).toBeGreaterThan(top('GET api.open-meteo.com/v1/forecast'))
    }
    finally {
      await resetViewport()
    }
  })

  it('unfolds in 200 ms, and without any animation where motion is reduced', async () => {
    const screen = await mount(listOf())
    await triggerOf(screen, 'forecast').click()
    const body = () => inside(screen, 'forecast').element().closest('[data-state]')!

    await expect.element(inside(screen, 'forecast')).toBeVisible()
    expect(getComputedStyle(body()).animationName).toBe('none')

    await withMotionAllowed(async () => {
      expect(getComputedStyle(body()).animationName).not.toBe('none')
      expect(getComputedStyle(body()).animationDuration).toBe('0.2s')
    })
  })

  it('is accessible and does not overflow in every state, and paints nothing in the seal colour itself', async () => {
    const screen = await mount(DataSourceRowGallery)

    expect(elementsInSealColour(screen.container)).toEqual([])
    await expectAccessible()
    await expectNoHorizontalOverflow()
  })
})
