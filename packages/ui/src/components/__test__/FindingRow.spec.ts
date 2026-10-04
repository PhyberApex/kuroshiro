import { describe, expect, it } from 'vitest'
import { userEvent } from 'vitest/browser'
import { defineComponent, h, reactive, ref } from 'vue'
import { expectAccessible } from '@/testing/a11y'
import { withMotionAllowed } from '@/testing/media'
import { mount } from '@/testing/mount'
import { expectNoHorizontalOverflow } from '@/testing/overflow'
import { elementsInSealColour } from '@/testing/sealColour'
import { resetViewport, resizeTo } from '@/testing/viewport'
import FindingRowGallery from '../FindingRow.gallery.vue'
import FindingRow from '../FindingRow.vue'
import FindingRows from '../FindingRows.vue'

const GROUPS = [
  { name: 'Images no Screen uses', count: '6 files', size: '412 KB' },
  { name: 'Uploads older than a day', count: '2 files', size: '2.2 MB' },
  { name: 'Screens whose image is missing', count: '1 Screen', size: undefined },
]

function listOf(ticked: Record<string, boolean> = reactive({ 'Images no Screen uses': true })) {
  return defineComponent(() => {
    const open = ref<string>()
    return () => h(FindingRows, { 'open': open.value, 'onUpdate:open': (value?: string) => (open.value = value) }, () => GROUPS.map(group =>
      h(FindingRow, {
        'value': group.name,
        'name': group.name,
        'count': group.count,
        'size': group.size,
        'ticked': ticked[group.name] ?? false,
        'onUpdate:ticked': (value: boolean) => (ticked[group.name] = value),
      }, () => h('p', `Inside ${group.name}`))))
  })
}

type Mounted = Awaited<ReturnType<typeof mount>>

const triggerOf = (screen: Mounted, name: string) => screen.getByRole('button', { name, exact: true })
const boxOf = (screen: Mounted, name: string) => screen.getByRole('checkbox', { name, exact: true })
const inside = (screen: Mounted, name: string) => screen.getByText(`Inside ${name}`)

describe('the Finding row', () => {
  it('shows a checkbox, the group as a button in a heading, its count and its size, closed', async () => {
    const screen = await mount(listOf())

    await expect.element(screen.getByRole('heading', { name: 'Images no Screen uses', level: 4 })).toBeVisible()
    await expect.element(triggerOf(screen, 'Images no Screen uses')).toHaveAttribute('aria-expanded', 'false')
    await expect.element(boxOf(screen, 'Images no Screen uses')).toBeChecked()
    await expect.element(boxOf(screen, 'Uploads older than a day')).not.toBeChecked()
    await expect.element(screen.getByText('6 files')).toBeVisible()
    await expect.element(screen.getByText('412 KB')).toBeVisible()
    expect(inside(screen, 'Images no Screen uses').elements()).toEqual([])
    expect(screen.getByRole('listitem').elements()).toHaveLength(3)
  })

  it('ticks and unticks without opening, and opens without ticking', async () => {
    const ticked = reactive<Record<string, boolean>>({})
    const screen = await mount(listOf(ticked))

    await boxOf(screen, 'Uploads older than a day').click()
    await expect.element(boxOf(screen, 'Uploads older than a day')).toBeChecked()
    expect(ticked).toEqual({ 'Uploads older than a day': true })
    await expect.element(triggerOf(screen, 'Uploads older than a day')).toHaveAttribute('aria-expanded', 'false')

    await triggerOf(screen, 'Uploads older than a day').click()
    await expect.element(inside(screen, 'Uploads older than a day')).toBeVisible()
    expect(ticked).toEqual({ 'Uploads older than a day': true })

    await boxOf(screen, 'Uploads older than a day').click()
    await expect.element(boxOf(screen, 'Uploads older than a day')).not.toBeChecked()
    await expect.element(inside(screen, 'Uploads older than a day')).toBeVisible()
  })

  it('opens in place, one row at a time, from anywhere on its line but the checkbox', async () => {
    const screen = await mount(listOf())

    await screen.getByText('6 files').click()
    await expect.element(inside(screen, 'Images no Screen uses')).toBeVisible()
    await expect.element(screen.getByRole('region', { name: 'Images no Screen uses' })).toBeVisible()

    await screen.getByText('2.2 MB').click()
    await expect.element(inside(screen, 'Uploads older than a day')).toBeVisible()
    await expect.poll(() => inside(screen, 'Images no Screen uses').elements()).toEqual([])

    await triggerOf(screen, 'Uploads older than a day').click()
    await expect.poll(() => inside(screen, 'Uploads older than a day').elements()).toEqual([])
  })

  it('is ticked with Space and opened with Enter from the keyboard, the checkbox before the name', async () => {
    const ticked = reactive<Record<string, boolean>>({})
    const screen = await mount(listOf(ticked))

    await userEvent.keyboard('{Tab}')
    await expect.element(boxOf(screen, 'Images no Screen uses')).toHaveFocus()
    await userEvent.keyboard(' ')
    await expect.element(boxOf(screen, 'Images no Screen uses')).toBeChecked()
    expect(inside(screen, 'Images no Screen uses').elements()).toEqual([])

    await userEvent.keyboard('{Tab}')
    await expect.element(triggerOf(screen, 'Images no Screen uses')).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    await expect.element(inside(screen, 'Images no Screen uses')).toBeVisible()
    await userEvent.keyboard(' ')
    await expect.poll(() => inside(screen, 'Images no Screen uses').elements()).toEqual([])
    expect(ticked).toEqual({ 'Images no Screen uses': true })

    await userEvent.keyboard('{ArrowDown}')
    await expect.element(triggerOf(screen, 'Uploads older than a day')).toHaveFocus()
  })

  it('puts the count and the size under the name on a phone', async () => {
    const screen = await mount(listOf())
    const top = (text: string) => screen.getByText(text).element().getBoundingClientRect().top
    const nameBottom = () => triggerOf(screen, 'Images no Screen uses').element().getBoundingClientRect().bottom

    expect(top('6 files')).toBeLessThan(nameBottom())

    await resizeTo(375)
    try {
      expect(top('6 files')).toBeGreaterThanOrEqual(nameBottom())
      expect(top('412 KB')).toBe(top('6 files'))
    }
    finally {
      await resetViewport()
    }
  })

  it('unfolds in 200 ms, and without any animation where motion is reduced', async () => {
    const screen = await mount(listOf())
    await triggerOf(screen, 'Images no Screen uses').click()
    const body = () => inside(screen, 'Images no Screen uses').element().closest('[data-state]')!

    await expect.element(inside(screen, 'Images no Screen uses')).toBeVisible()
    expect(getComputedStyle(body()).animationName).toBe('none')

    await withMotionAllowed(async () => {
      expect(getComputedStyle(body()).animationName).not.toBe('none')
      expect(getComputedStyle(body()).animationDuration).toBe('0.2s')
    })
  })

  it('is accessible and does not overflow in every state, and paints nothing in the seal colour', async () => {
    const screen = await mount(FindingRowGallery)

    expect(elementsInSealColour(screen.container)).toEqual([])
    await expectAccessible()
    await expectNoHorizontalOverflow()
  })
})
