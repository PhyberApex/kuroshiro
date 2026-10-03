import { describe, expect, it, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import { expectAccessible } from '@/testing/a11y'
import { withCoarsePointer } from '@/testing/media'
import { mount } from '@/testing/mount'
import { expectNoHorizontalOverflow } from '@/testing/overflow'
import DateInputGallery from '../DateInput.gallery.vue'
import DateInput from '../DateInput.vue'

const FROM = { 'aria-label': 'From' }

describe('date input', () => {
  it('is a native date input that shows its value and reports the date as the API takes it', async () => {
    const onUpdate = vi.fn()
    const screen = await mount(DateInput, { props: { 'modelValue': '2026-10-03', 'onUpdate:modelValue': onUpdate }, attrs: FROM })
    const input = screen.getByLabelText('From')
    await expect.element(input).toHaveAttribute('type', 'date')
    await expect.element(input).toHaveValue('2026-10-03')

    await input.fill('2026-12-24')

    expect(onUpdate).toHaveBeenLastCalledWith('2026-12-24')
  })

  it('reports null once it is cleared', async () => {
    const onUpdate = vi.fn()
    const screen = await mount(DateInput, { props: { 'modelValue': '2026-10-03', 'onUpdate:modelValue': onUpdate }, attrs: FROM })

    await screen.getByLabelText('From').fill('')

    expect(onUpdate).toHaveBeenLastCalledWith(null)
  })

  it('reports "commit" on Enter and on blur only, not as its parts are filled in', async () => {
    const onCommit = vi.fn()
    const screen = await mount(DateInput, { props: { modelValue: '2026-10-03', onCommit }, attrs: FROM })
    const input = screen.getByLabelText('From')

    await input.fill('2026-12-24')
    expect(onCommit).not.toHaveBeenCalled()
    await userEvent.keyboard('{Enter}')
    expect(onCommit).toHaveBeenCalledExactlyOnceWith('2026-12-24')

    await input.fill('2027-01-06')
    await userEvent.keyboard('{Tab}{Tab}{Tab}{Tab}')
    expect(onCommit).toHaveBeenLastCalledWith('2027-01-06')
    expect(onCommit).toHaveBeenCalledTimes(2)
  })

  it('forwards its id and its description, marks an invalid value and can be disabled', async () => {
    const screen = await mount(DateInput, {
      props: { modelValue: '2026-10-03', invalid: true, disabled: true },
      attrs: { ...FROM, 'id': 'from', 'aria-describedby': 'from-error' },
    })
    const input = screen.getByLabelText('From')

    await expect.element(input).toHaveAttribute('id', 'from')
    await expect.element(input).toHaveAttribute('aria-describedby', 'from-error')
    await expect.element(input).toHaveAttribute('aria-invalid', 'true')
    await expect.element(input).toBeDisabled()
  })

  it('is 32 px high, and 44 px with 16 px text at a coarse pointer', async () => {
    const screen = await mount(DateInput, { props: { modelValue: '2026-10-03' }, attrs: FROM })
    const input = screen.getByLabelText('From').element()

    expect(input.getBoundingClientRect().height).toBe(32)
    await withCoarsePointer(async () => {
      expect(input.getBoundingClientRect().height).toBe(44)
      expect(getComputedStyle(input).fontSize).toBe('16px')
    })
  })

  it('is accessible and does not overflow in every state', async () => {
    await mount(DateInputGallery)

    await expectAccessible()
    await expectNoHorizontalOverflow()
  })
})
