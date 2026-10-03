import { describe, expect, it, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import { expectAccessible } from '@/testing/a11y'
import { mount } from '@/testing/mount'
import { expectNoHorizontalOverflow } from '@/testing/overflow'
import NumberInputGallery from '../NumberInput.gallery.vue'
import NumberInput from '../NumberInput.vue'

const RATE = { 'aria-label': 'Refresh rate' }

describe('number input', () => {
  it('shows its number and reports what is typed as a number', async () => {
    const onUpdate = vi.fn()
    const screen = await mount(NumberInput, { props: { 'modelValue': 900, 'onUpdate:modelValue': onUpdate }, attrs: RATE })
    const input = screen.getByRole('spinbutton', { name: 'Refresh rate' })
    await expect.element(input).toHaveValue(900)

    await input.fill('60')

    expect(onUpdate).toHaveBeenLastCalledWith(60)
  })

  it('reports null for an input that holds no number', async () => {
    const onUpdate = vi.fn()
    const screen = await mount(NumberInput, { props: { 'modelValue': 900, 'onUpdate:modelValue': onUpdate }, attrs: RATE })

    await screen.getByRole('spinbutton', { name: 'Refresh rate' }).fill('')

    expect(onUpdate).toHaveBeenLastCalledWith(null)
  })

  it('keeps a fraction as it is typed', async () => {
    const onUpdate = vi.fn()
    const screen = await mount(NumberInput, { props: { 'modelValue': null, 'onUpdate:modelValue': onUpdate }, attrs: RATE })
    const input = screen.getByRole('spinbutton', { name: 'Refresh rate' })

    await input.click()
    await userEvent.keyboard('1.50')
    await screen.rerender({ modelValue: 1.5 })

    expect(onUpdate).toHaveBeenLastCalledWith(1.5)
    expect((input.element() as HTMLInputElement).value).toBe('1.50')
  })

  it('follows a number set from outside', async () => {
    const screen = await mount(NumberInput, { props: { modelValue: 900 }, attrs: RATE })

    await screen.rerender({ modelValue: 300 })

    await expect.element(screen.getByRole('spinbutton', { name: 'Refresh rate' })).toHaveValue(300)
  })

  it('reports "commit" with the number on Enter and on blur only', async () => {
    const onCommit = vi.fn()
    const screen = await mount(NumberInput, { props: { modelValue: 900, onCommit }, attrs: RATE })
    const input = screen.getByRole('spinbutton', { name: 'Refresh rate' })

    await input.fill('60')
    expect(onCommit).not.toHaveBeenCalled()
    await userEvent.keyboard('{Enter}')
    expect(onCommit).toHaveBeenCalledExactlyOnceWith(60)

    await input.fill('120')
    await userEvent.keyboard('{Tab}')
    expect(onCommit).toHaveBeenLastCalledWith(120)
    expect(onCommit).toHaveBeenCalledTimes(2)
  })

  it('does not commit the same number written another way', async () => {
    const onCommit = vi.fn()
    const screen = await mount(NumberInput, { props: { modelValue: 60, onCommit }, attrs: RATE })

    await screen.getByRole('spinbutton', { name: 'Refresh rate' }).fill('60.0')
    await userEvent.keyboard('{Enter}')

    expect(onCommit).not.toHaveBeenCalled()
  })

  it('forwards its id, its range and its description, marks an invalid number and can be disabled', async () => {
    const screen = await mount(NumberInput, {
      props: { modelValue: 12, invalid: true, disabled: true },
      attrs: { ...RATE, 'id': 'refresh-rate', 'min': 60, 'aria-describedby': 'refresh-rate-error' },
    })
    const input = screen.getByRole('spinbutton', { name: 'Refresh rate' })

    await expect.element(input).toHaveAttribute('id', 'refresh-rate')
    await expect.element(input).toHaveAttribute('min', '60')
    await expect.element(input).toHaveAttribute('aria-describedby', 'refresh-rate-error')
    await expect.element(input).toHaveAttribute('aria-invalid', 'true')
    await expect.element(input).toBeDisabled()
  })

  it('is accessible and does not overflow in every state', async () => {
    await mount(NumberInputGallery)

    await expectAccessible()
    await expectNoHorizontalOverflow()
  })
})
