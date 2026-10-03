import { describe, expect, it, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import { expectAccessible } from '@/testing/a11y'
import { withCoarsePointer, withMotionAllowed } from '@/testing/media'
import { mount } from '@/testing/mount'
import { expectNoHorizontalOverflow } from '@/testing/overflow'
import SwitchGallery from '../Switch.gallery.vue'
import Switch from '../Switch.vue'

describe('switch', () => {
  it('is a switch named by its label that announces whether it is on', async () => {
    const screen = await mount(Switch, { props: { modelValue: true }, slots: { default: 'Sleep Mode' } })
    const control = screen.getByRole('switch', { name: 'Sleep Mode' })

    await expect.element(control).toHaveAttribute('aria-checked', 'true')

    await screen.rerender({ modelValue: false })
    await expect.element(control).toHaveAttribute('aria-checked', 'false')
  })

  it('toggles on a click, on a click on its label, on Space and on Enter', async () => {
    const onUpdate = vi.fn<(value: boolean) => void>()
    const screen = await mount(Switch, { props: { 'modelValue': false, 'onUpdate:modelValue': onUpdate }, slots: { default: 'Sleep Mode' } })
    onUpdate.mockImplementation(value => screen.rerender({ modelValue: value }))

    await screen.getByRole('switch', { name: 'Sleep Mode' }).click()
    expect(onUpdate).toHaveBeenLastCalledWith(true)

    await screen.getByText('Sleep Mode').click()
    expect(onUpdate).toHaveBeenLastCalledWith(false)

    await userEvent.keyboard(' ')
    expect(onUpdate).toHaveBeenLastCalledWith(true)

    await userEvent.keyboard('{Enter}')
    expect(onUpdate).toHaveBeenLastCalledWith(false)
    expect(onUpdate).toHaveBeenCalledTimes(4)
  })

  it('is reached with Tab', async () => {
    const screen = await mount(Switch, { slots: { default: 'Sleep Mode' } })

    await userEvent.keyboard('{Tab}')

    await expect.element(screen.getByRole('switch', { name: 'Sleep Mode' })).toHaveFocus()
  })

  it('does not toggle while disabled, by pointer or by key', async () => {
    const onUpdate = vi.fn()
    const screen = await mount(Switch, { props: { 'disabled': true, 'onUpdate:modelValue': onUpdate }, slots: { default: 'Sleep Mode' } })
    const control = screen.getByRole('switch', { name: 'Sleep Mode' })

    await expect.element(control).toBeDisabled()
    await control.click({ force: true })
    await screen.getByText('Sleep Mode').click({ force: true })
    await userEvent.keyboard('{Tab} {Enter}')

    expect(onUpdate).not.toHaveBeenCalled()
  })

  it('forwards its id, its name and its description to the switch', async () => {
    const screen = await mount(Switch, {
      attrs: { 'id': 'sleep-mode', 'aria-label': 'Sleep Mode', 'aria-describedby': 'sleep-mode-status' },
    })
    const control = screen.getByRole('switch', { name: 'Sleep Mode' })

    await expect.element(control).toHaveAttribute('id', 'sleep-mode')
    await expect.element(control).toHaveAttribute('aria-describedby', 'sleep-mode-status')
  })

  it('is 32 by 16 px and changes in 120 ms', async () => {
    const screen = await mount(Switch, { slots: { default: 'Sleep Mode' } })
    const control = screen.getByRole('switch', { name: 'Sleep Mode' })

    await expect.element(control).toHaveStyle({ width: '32px', height: '16px' })
    await withMotionAllowed(async () => {
      const thumb = control.element().firstElementChild!
      expect(getComputedStyle(control.element()).transitionDuration).toContain('0.12s')
      expect(getComputedStyle(thumb).transitionDuration).toContain('0.12s')
    })
  })

  it('is busy while its change is being saved and still shows what was chosen', async () => {
    const screen = await mount(Switch, { props: { modelValue: true, saving: true }, slots: { default: 'Sleep Mode' } })
    const control = screen.getByRole('switch', { name: 'Sleep Mode' })

    await expect.element(control).toHaveAttribute('aria-busy', 'true')
    await expect.element(control).toHaveAttribute('aria-checked', 'true')
  })

  it('shows saving as a blinking thumb, and as a hollow one where motion is reduced', async () => {
    const screen = await mount(Switch, { props: { saving: true }, slots: { default: 'Sleep Mode' } })
    const thumb = screen.getByRole('switch', { name: 'Sleep Mode' }).element().firstElementChild!

    await expect.poll(() => getComputedStyle(thumb).backgroundColor).toBe('rgba(0, 0, 0, 0)')
    expect(getComputedStyle(thumb).boxShadow).toContain('inset')
    await withMotionAllowed(async () => {
      expect(getComputedStyle(thumb).animationDuration).toBe('1s')
      expect(getComputedStyle(thumb).boxShadow).toBe('none')
    })
  })

  it('doubles its border when its change could not be saved', async () => {
    const screen = await mount(Switch, { props: { error: true }, slots: { default: 'Sleep Mode' } })
    const control = screen.getByRole('switch', { name: 'Sleep Mode' })

    await expect.poll(() => getComputedStyle(control.element()).boxShadow).toContain('inset')

    await screen.rerender({ error: false })
    await expect.poll(() => getComputedStyle(control.element()).boxShadow).toBe('none')
  })

  it('has a place beside it for the save state, outside its label', async () => {
    const screen = await mount(Switch, { slots: { default: 'Sleep Mode', status: 'Not saved' } })

    await expect.element(screen.getByRole('switch', { name: 'Sleep Mode' })).toBeVisible()
    expect(screen.container.textContent).toContain('Not saved')
    expect(screen.container.querySelector('label')!.textContent).not.toContain('Not saved')
  })

  it('is a 44 px target at a coarse pointer', async () => {
    const screen = await mount(Switch, { slots: { default: 'Sleep Mode' } })
    const label = screen.getByText('Sleep Mode').element().closest('label')!

    await withCoarsePointer(async () => {
      expect(label.getBoundingClientRect().height).toBe(44)
    })
  })

  it('is accessible and does not overflow in every state', async () => {
    await mount(SwitchGallery)

    await expectAccessible()
    await expectNoHorizontalOverflow()
  })
})
