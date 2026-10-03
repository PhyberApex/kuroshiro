import type { PickableLayout } from '../LayoutPicker.vue'
import { describe, expect, it, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import { expectAccessible } from '@/testing/a11y'
import { pressAndHold } from '@/testing/keys'
import { withCoarsePointer } from '@/testing/media'
import { mount } from '@/testing/mount'
import { expectNoHorizontalOverflow } from '@/testing/overflow'
import LayoutPickerGallery from '../LayoutPicker.gallery.vue'
import LayoutPicker from '../LayoutPicker.vue'

const LAYOUTS: PickableLayout[] = [
  { id: '1Lx1R', name: 'Left and right', slotCount: 2 },
  { id: '1Tx1B', name: 'Top and bottom', slotCount: 2 },
  { id: '1Lx2R', name: 'One left, two right', slotCount: 3 },
  { id: '2Lx1R', name: 'Two left, one right', slotCount: 3 },
  { id: '2Tx1B', name: 'Two top, one bottom', slotCount: 3 },
  { id: '1Tx2B', name: 'One top, two bottom', slotCount: 3 },
  { id: '2x2', name: 'Four quarters', slotCount: 4 },
]

async function mountPicker(chosen: string | undefined, layouts = LAYOUTS) {
  const onUpdate = vi.fn<(id: string) => void>()
  const screen = await mount(LayoutPicker, {
    props: { layouts, 'modelValue': chosen, 'onUpdate:modelValue': onUpdate },
    attrs: { 'aria-label': 'Layout' },
  })
  onUpdate.mockImplementation(id => screen.rerender({ modelValue: id }))
  return { screen, onUpdate }
}

describe('layout picker', () => {
  it('is a named radio group with one radio per layout it is given, named in words', async () => {
    const { screen } = await mountPicker('1Lx2R')
    const group = screen.getByRole('radiogroup', { name: 'Layout' })

    expect(group.getByRole('radio').elements().map(radio => radio.textContent?.trim())).toEqual(LAYOUTS.map(layout => layout.name))
    await expect.element(group.getByRole('radio', { name: 'One left, two right' })).toBeChecked()
    await expect.element(group.getByRole('radio', { name: 'Four quarters' })).not.toBeChecked()
  })

  it.each(LAYOUTS)('draws $name with $slotCount slots', async ({ name, slotCount }) => {
    const { screen } = await mountPicker(undefined)

    const drawing = screen.getByRole('radio', { name }).element().querySelector('svg')!

    expect(drawing.querySelectorAll('rect')).toHaveLength(slotCount)
    expect(drawing.getAttribute('aria-hidden')).toBe('true')
  })

  it('shows only the layouts it is given', async () => {
    const { screen } = await mountPicker(undefined, LAYOUTS.slice(0, 2))

    expect(screen.getByRole('radio').elements()).toHaveLength(2)
  })

  it('chooses a layout on a click', async () => {
    const { screen, onUpdate } = await mountPicker('1Lx1R')

    await screen.getByRole('radio', { name: 'Four quarters' }).click()

    expect(onUpdate).toHaveBeenLastCalledWith('2x2')
    await expect.element(screen.getByRole('radio', { name: 'Four quarters' })).toBeChecked()
  })

  it('is one Tab stop on the chosen layout, and the arrow keys move and choose', async () => {
    const { screen, onUpdate } = await mountPicker('1Lx1R')

    await userEvent.keyboard('{Tab}')
    await expect.element(screen.getByRole('radio', { name: 'Left and right' })).toHaveFocus()

    await pressAndHold('ArrowRight')
    await expect.element(screen.getByRole('radio', { name: 'Top and bottom' })).toBeChecked()
    expect(onUpdate).toHaveBeenLastCalledWith('1Tx1B')

    await pressAndHold('ArrowLeft')
    await pressAndHold('ArrowLeft')
    await expect.element(screen.getByRole('radio', { name: 'Four quarters' })).toBeChecked()

    await userEvent.keyboard('{Tab}')
    expect(screen.getByRole('radiogroup').element().contains(document.activeElement)).toBe(false)
  })

  it('is at least a 44 px target at a coarse pointer', async () => {
    const { screen } = await mountPicker('1Lx1R')
    const layout = screen.getByRole('radio', { name: 'Left and right' }).element()

    await withCoarsePointer(async () => {
      expect(layout.getBoundingClientRect().height).toBeGreaterThanOrEqual(44)
      expect(layout.getBoundingClientRect().width).toBeGreaterThanOrEqual(44)
    })
  })

  it('is accessible and does not overflow in every state', async () => {
    await mount(LayoutPickerGallery)

    await expectAccessible()
    await expectNoHorizontalOverflow()
  })
})
