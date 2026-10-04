import { describe, expect, it, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import { expectAccessible } from '@/testing/a11y'
import { withCoarsePointer } from '@/testing/media'
import { mount } from '@/testing/mount'
import { expectNoHorizontalOverflow } from '@/testing/overflow'
import CheckboxGallery from '../Checkbox.gallery.vue'
import Checkbox from '../Checkbox.vue'

describe('checkbox', () => {
  it('is a native checkbox named by its label, ticked or not as its value says', async () => {
    const screen = await mount(Checkbox, { props: { modelValue: true }, slots: { default: 'All day' } })
    const checkbox = screen.getByRole('checkbox', { name: 'All day' })

    await expect.element(checkbox).toBeChecked()
    expect(checkbox.element().localName).toBe('input')

    await screen.rerender({ modelValue: false })
    await expect.element(checkbox).not.toBeChecked()
  })

  it('toggles on a click on the box, on a click on its label and on Space', async () => {
    const onUpdate = vi.fn()
    const screen = await mount(Checkbox, { props: { 'modelValue': false, 'onUpdate:modelValue': onUpdate }, slots: { default: 'All day' } })

    await screen.getByRole('checkbox', { name: 'All day' }).click()
    expect(onUpdate).toHaveBeenLastCalledWith(true)

    await screen.getByText('All day').click()
    expect(onUpdate).toHaveBeenLastCalledWith(false)

    await userEvent.keyboard(' ')
    expect(onUpdate).toHaveBeenLastCalledWith(true)
    expect(onUpdate).toHaveBeenCalledTimes(3)
  })

  it('is reached with Tab', async () => {
    const screen = await mount(Checkbox, { slots: { default: 'All day' } })

    await userEvent.keyboard('{Tab}')

    await expect.element(screen.getByRole('checkbox', { name: 'All day' })).toHaveFocus()
  })

  it('does not toggle while disabled', async () => {
    const onUpdate = vi.fn()
    const screen = await mount(Checkbox, { props: { 'disabled': true, 'onUpdate:modelValue': onUpdate }, slots: { default: 'All day' } })
    const checkbox = screen.getByRole('checkbox', { name: 'All day' })

    await expect.element(checkbox).toBeDisabled()
    await checkbox.click({ force: true })

    expect(onUpdate).not.toHaveBeenCalled()
  })

  it('forwards its id, its name and its description to the input, and marks an invalid value', async () => {
    const screen = await mount(Checkbox, {
      props: { invalid: true },
      attrs: { 'id': 'fits-og', 'aria-label': 'Images no Screen uses', 'aria-describedby': 'fits-error' },
    })
    const checkbox = screen.getByRole('checkbox', { name: 'Images no Screen uses' })

    await expect.element(checkbox).toHaveAttribute('id', 'fits-og')
    await expect.element(checkbox).toHaveAttribute('aria-describedby', 'fits-error')
    await expect.element(checkbox).toHaveAttribute('aria-invalid', 'true')
  })

  it('draws its tick on a 16 px box, only while it is on', async () => {
    const screen = await mount(Checkbox, { props: { modelValue: true }, slots: { default: 'All day' } })
    const checkbox = screen.getByRole('checkbox', { name: 'All day' })

    await expect.element(checkbox).toHaveStyle({ width: '16px', height: '16px' })
    await expect.element(screen.container.querySelector('svg')).toBeVisible()

    await screen.rerender({ modelValue: false })
    await expect.element(screen.container.querySelector('svg')).not.toBeVisible()
  })

  it('is a 44 px target at a coarse pointer', async () => {
    const screen = await mount(Checkbox, { slots: { default: 'All day' } })
    const label = screen.getByText('All day').element().closest('label')!

    await withCoarsePointer(async () => {
      expect(label.getBoundingClientRect().height).toBe(44)
    })
  })

  it('is accessible and does not overflow in every state', async () => {
    await mount(CheckboxGallery)

    await expectAccessible()
    await expectNoHorizontalOverflow()
  })
})
