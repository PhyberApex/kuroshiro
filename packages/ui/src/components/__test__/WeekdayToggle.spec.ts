import type { Weekday } from '../WeekdayToggle.vue'
import { describe, expect, it, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import { expectAccessible } from '@/testing/a11y'
import { withCoarsePointer } from '@/testing/media'
import { mount } from '@/testing/mount'
import { expectNoHorizontalOverflow } from '@/testing/overflow'
import WeekdayToggleGallery from '../WeekdayToggle.gallery.vue'
import WeekdayToggle from '../WeekdayToggle.vue'

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

async function mountDays(chosen: Weekday[], props: { disabled?: boolean } = {}) {
  const onUpdate = vi.fn<(weekdays: Weekday[]) => void>()
  const screen = await mount(WeekdayToggle, {
    props: { ...props, 'modelValue': chosen, 'onUpdate:modelValue': onUpdate },
    attrs: { 'aria-label': 'Days' },
  })
  onUpdate.mockImplementation(weekdays => screen.rerender({ modelValue: weekdays }))
  return { screen, onUpdate }
}

describe('weekday toggle', () => {
  it('is a named group of seven days, Monday first, each named in full', async () => {
    const { screen } = await mountDays([])
    const group = screen.getByRole('group', { name: 'Days' })

    await expect.element(group).toBeVisible()
    expect(group.getByRole('button').elements().map(day => day.getAttribute('aria-label'))).toEqual(DAY_NAMES)
    expect(group.getByRole('button').elements().map(day => day.textContent?.trim())).toEqual(['M', 'T', 'W', 'T', 'F', 'S', 'S'])
  })

  it('presses the days its value holds, where 0 is Sunday', async () => {
    const { screen } = await mountDays([0, 2])

    await expect.element(screen.getByRole('button', { name: 'Sunday' })).toHaveAttribute('aria-pressed', 'true')
    await expect.element(screen.getByRole('button', { name: 'Tuesday' })).toHaveAttribute('aria-pressed', 'true')
    await expect.element(screen.getByRole('button', { name: 'Monday' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('turns several days on and one off again, and gives the days back in weekday order', async () => {
    const { screen, onUpdate } = await mountDays([2])

    await screen.getByRole('button', { name: 'Sunday' }).click()
    expect(onUpdate).toHaveBeenLastCalledWith([0, 2])

    await screen.getByRole('button', { name: 'Monday' }).click()
    expect(onUpdate).toHaveBeenLastCalledWith([0, 1, 2])

    await screen.getByRole('button', { name: 'Tuesday' }).click()
    expect(onUpdate).toHaveBeenLastCalledWith([0, 1])
    await expect.element(screen.getByRole('button', { name: 'Tuesday' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('moves between days with the arrow keys and toggles with Space, as one Tab stop', async () => {
    const { screen, onUpdate } = await mountDays([])

    await userEvent.keyboard('{Tab}')
    await expect.element(screen.getByRole('button', { name: 'Monday' })).toHaveFocus()

    await userEvent.keyboard('{ArrowRight}')
    await expect.element(screen.getByRole('button', { name: 'Tuesday' })).toHaveFocus()
    await userEvent.keyboard('{ArrowRight}')
    await expect.element(screen.getByRole('button', { name: 'Wednesday' })).toHaveFocus()
    expect(onUpdate).not.toHaveBeenCalled()

    await userEvent.keyboard(' ')
    expect(onUpdate).toHaveBeenLastCalledWith([3])

    await userEvent.keyboard('{ArrowLeft}')
    await expect.element(screen.getByRole('button', { name: 'Tuesday' })).toHaveFocus()

    await userEvent.keyboard('{Tab}')
    expect(screen.getByRole('group').element().contains(document.activeElement)).toBe(false)
  })

  it('does not toggle while disabled', async () => {
    const { screen, onUpdate } = await mountDays([1], { disabled: true })
    const monday = screen.getByRole('button', { name: 'Monday' })

    await expect.element(monday).toBeDisabled()
    await monday.click({ force: true })

    expect(onUpdate).not.toHaveBeenCalled()
  })

  it('is 32 px square, and a 44 px high target at a coarse pointer', async () => {
    const { screen } = await mountDays([])
    const monday = screen.getByRole('button', { name: 'Monday' })

    await expect.element(monday).toHaveStyle({ width: '32px', height: '32px' })
    await withCoarsePointer(async () => {
      expect(monday.element().getBoundingClientRect().height).toBe(44)
    })
  })

  it('is accessible and does not overflow in every state', async () => {
    await mount(WeekdayToggleGallery)

    await expectAccessible()
    await expectNoHorizontalOverflow()
  })
})
