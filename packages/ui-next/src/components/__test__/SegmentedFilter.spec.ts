import type { Segment } from '../SegmentedFilter.vue'
import { describe, expect, it, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import { expectAccessible } from '@/testing/a11y'
import { pressAndHold } from '@/testing/keys'
import { withCoarsePointer } from '@/testing/media'
import { mount } from '@/testing/mount'
import { expectNoHorizontalOverflow } from '@/testing/overflow'
import SegmentedFilterGallery from '../SegmentedFilter.gallery.vue'
import SegmentedFilter from '../SegmentedFilter.vue'

const APPEARANCES: Segment<string>[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

async function mountFilter(chosen: string, props: { segments?: Segment<string>[], disabled?: boolean } = {}) {
  const onUpdate = vi.fn<(value: string) => void>()
  const screen = await mount(SegmentedFilter, {
    props: { 'segments': APPEARANCES, ...props, 'modelValue': chosen, 'onUpdate:modelValue': onUpdate },
    attrs: { 'aria-label': 'Appearance' },
  })
  onUpdate.mockImplementation(value => screen.rerender({ modelValue: value }))
  return { screen, onUpdate }
}

describe('segmented filter', () => {
  it('is a named radio group with one segment chosen', async () => {
    const { screen } = await mountFilter('light')
    const group = screen.getByRole('radiogroup', { name: 'Appearance' })

    expect(group.getByRole('radio').elements().map(radio => radio.textContent?.trim())).toEqual(['System', 'Light', 'Dark'])
    await expect.element(group.getByRole('radio', { name: 'Light' })).toBeChecked()
    await expect.element(group.getByRole('radio', { name: 'System' })).not.toBeChecked()
  })

  it('chooses a segment on a click, and keeps one chosen when the chosen one is clicked again', async () => {
    const { screen, onUpdate } = await mountFilter('light')

    await screen.getByRole('radio', { name: 'Dark' }).click()
    expect(onUpdate).toHaveBeenLastCalledWith('dark')

    await screen.getByRole('radio', { name: 'Dark' }).click()
    await expect.element(screen.getByRole('radio', { name: 'Dark' })).toBeChecked()
  })

  it('is one Tab stop on the chosen segment, and the arrow keys move and choose', async () => {
    const { screen, onUpdate } = await mountFilter('light')

    await userEvent.keyboard('{Tab}')
    await expect.element(screen.getByRole('radio', { name: 'Light' })).toHaveFocus()

    await pressAndHold('ArrowRight')
    await expect.element(screen.getByRole('radio', { name: 'Dark' })).toHaveFocus()
    await expect.element(screen.getByRole('radio', { name: 'Dark' })).toBeChecked()
    expect(onUpdate).toHaveBeenLastCalledWith('dark')

    await pressAndHold('ArrowLeft')
    await expect.element(screen.getByRole('radio', { name: 'Light' })).toBeChecked()

    await userEvent.keyboard('{Tab}')
    expect(screen.getByRole('radiogroup').element().contains(document.activeElement)).toBe(false)
  })

  it('skips a disabled segment', async () => {
    const segments = APPEARANCES.map(segment => ({ ...segment, disabled: segment.value === 'light' }))
    const { screen, onUpdate } = await mountFilter('system', { segments })

    await userEvent.keyboard('{Tab}')
    await pressAndHold('ArrowRight')

    await expect.element(screen.getByRole('radio', { name: 'Dark' })).toBeChecked()

    await screen.getByRole('radio', { name: 'Light' }).click({ force: true })
    expect(onUpdate).toHaveBeenCalledExactlyOnceWith('dark')
  })

  it('chooses nothing while the whole filter is disabled', async () => {
    const { screen, onUpdate } = await mountFilter('light', { disabled: true })

    await expect.element(screen.getByRole('radio', { name: 'Dark' })).toBeDisabled()
    await screen.getByRole('radio', { name: 'Dark' }).click({ force: true })

    expect(onUpdate).not.toHaveBeenCalled()
  })

  it('reads a segment\'s problem out with its label', async () => {
    const segments = APPEARANCES.map(segment => ({ ...segment, problem: segment.value === 'dark' ? 'does not parse' : undefined }))
    const { screen } = await mountFilter('light', { segments })

    await expect.element(screen.getByRole('radio', { name: 'Dark does not parse' })).toBeVisible()
    await expect.element(screen.getByRole('img', { name: 'does not parse' })).toBeVisible()
  })

  it('is 32 px high, and 44 px at a coarse pointer', async () => {
    const { screen } = await mountFilter('light')
    const group = screen.getByRole('radiogroup').element()

    expect(group.getBoundingClientRect().height).toBe(32)
    await withCoarsePointer(async () => {
      expect(group.getBoundingClientRect().height).toBe(44)
    })
  })

  it('is accessible and does not overflow in every state', async () => {
    await mount(SegmentedFilterGallery)

    await expectAccessible()
    await expectNoHorizontalOverflow()
  })
})
