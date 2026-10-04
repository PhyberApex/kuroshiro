import { describe, expect, it, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import { h } from 'vue'
import { expectAccessible } from '@/testing/a11y'
import { withCoarsePointer } from '@/testing/media'
import { mount } from '@/testing/mount'
import { expectNoHorizontalOverflow } from '@/testing/overflow'
import TextInputGallery from '../TextInput.gallery.vue'
import TextInput from '../TextInput.vue'

const NAME = { 'aria-label': 'Name' }

describe('text input', () => {
  it('shows its value and reports what is typed', async () => {
    const onUpdate = vi.fn()
    const screen = await mount(TextInput, { props: { 'modelValue': 'Kitchen', 'onUpdate:modelValue': onUpdate }, attrs: NAME })
    const input = screen.getByRole('textbox', { name: 'Name' })
    await expect.element(input).toHaveValue('Kitchen')

    await input.fill('Hallway')

    expect(onUpdate).toHaveBeenLastCalledWith('Hallway')
  })

  it('reports "commit" on Enter and on blur, not while typing', async () => {
    const onCommit = vi.fn()
    const screen = await mount(TextInput, { props: { modelValue: 'Kitchen', onCommit }, attrs: NAME })
    const input = screen.getByRole('textbox', { name: 'Name' })

    await input.fill('Hallway')
    expect(onCommit).not.toHaveBeenCalled()

    await userEvent.keyboard('{Enter}')
    expect(onCommit).toHaveBeenCalledExactlyOnceWith('Hallway')

    await input.fill('Porch')
    await userEvent.keyboard('{Tab}')
    expect(onCommit).toHaveBeenCalledTimes(2)
    expect(onCommit).toHaveBeenLastCalledWith('Porch')
  })

  it('does not commit a value that was not changed, or the same value twice', async () => {
    const onCommit = vi.fn()
    const screen = await mount(TextInput, { props: { modelValue: 'Kitchen', onCommit }, attrs: NAME })
    const input = screen.getByRole('textbox', { name: 'Name' })

    await input.click()
    await userEvent.keyboard('{Enter}')
    await userEvent.keyboard('{Tab}')
    expect(onCommit).not.toHaveBeenCalled()

    await input.fill('Hallway')
    await userEvent.keyboard('{Enter}')
    await userEvent.keyboard('{Tab}')
    expect(onCommit).toHaveBeenCalledTimes(1)
  })

  it('forwards its id and its description to the input, and marks an invalid value', async () => {
    const screen = await mount(TextInput, {
      props: { invalid: true },
      attrs: { ...NAME, 'id': 'device-name', 'aria-describedby': 'device-name-error' },
    })
    const input = screen.getByRole('textbox', { name: 'Name' })

    await expect.element(input).toHaveAttribute('id', 'device-name')
    await expect.element(input).toHaveAttribute('aria-describedby', 'device-name-error')
    await expect.element(input).toHaveAttribute('aria-invalid', 'true')
    await expect.element(input).toHaveStyle({ boxShadow: 'rgb(18, 18, 18) 0px 0px 0px 1px inset' })
  })

  it('cannot be typed in while disabled', async () => {
    const screen = await mount(TextInput, { props: { modelValue: 'Kitchen', disabled: true }, attrs: NAME })

    await expect.element(screen.getByRole('textbox', { name: 'Name' })).toBeDisabled()
  })

  it('has a place beside it for the save state', async () => {
    const screen = await mount(TextInput, {
      props: { modelValue: 'Hallway' },
      attrs: NAME,
      slots: { status: () => h('span', 'Saving') },
    })
    const input = screen.getByRole('textbox', { name: 'Name' }).element().getBoundingClientRect()
    const status = screen.getByText('Saving').element().getBoundingClientRect()

    expect(status.left).toBeGreaterThan(input.right)
    expect(status.top).toBeGreaterThanOrEqual(input.top)
    expect(status.bottom).toBeLessThanOrEqual(input.bottom)
  })

  it('is 32 px high, and 44 px with 16 px text at a coarse pointer', async () => {
    const screen = await mount(TextInput, { props: { modelValue: 'Kitchen' }, attrs: NAME })
    const input = screen.getByRole('textbox', { name: 'Name' }).element()

    expect(input.getBoundingClientRect().height).toBe(32)
    await withCoarsePointer(async () => {
      expect(input.getBoundingClientRect().height).toBe(44)
      expect(getComputedStyle(input).fontSize).toBe('16px')
    })
  })

  it('is accessible and does not overflow in every state', async () => {
    await mount(TextInputGallery)

    await expectAccessible()
    await expectNoHorizontalOverflow()
  })
})
