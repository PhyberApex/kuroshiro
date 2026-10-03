import { describe, expect, it, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import { expectAccessible } from '@/testing/a11y'
import { mount } from '@/testing/mount'
import { expectNoHorizontalOverflow } from '@/testing/overflow'
import TextareaGallery from '../Textarea.gallery.vue'
import Textarea from '../Textarea.vue'

const HTML = { 'aria-label': 'HTML' }

describe('textarea', () => {
  it('shows its text and reports what is typed', async () => {
    const onUpdate = vi.fn()
    const screen = await mount(Textarea, { props: { 'modelValue': '<p>Back at 6</p>', 'onUpdate:modelValue': onUpdate }, attrs: HTML })
    const textarea = screen.getByRole('textbox', { name: 'HTML' })
    await expect.element(textarea).toHaveValue('<p>Back at 6</p>')

    await textarea.fill('<p>Back at 7</p>')

    expect(onUpdate).toHaveBeenLastCalledWith('<p>Back at 7</p>')
  })

  it('takes Enter as a new line and reports "commit" on blur only', async () => {
    const onCommit = vi.fn()
    const screen = await mount(Textarea, { props: { modelValue: '', onCommit }, attrs: HTML })
    const textarea = screen.getByRole('textbox', { name: 'HTML' })

    await textarea.click()
    await userEvent.keyboard('Back{Enter}at 6')
    await expect.element(textarea).toHaveValue('Back\nat 6')
    expect(onCommit).not.toHaveBeenCalled()

    await userEvent.keyboard('{Tab}')
    expect(onCommit).toHaveBeenCalledExactlyOnceWith('Back\nat 6')
  })

  it('forwards its id and its description, marks an invalid text and can be disabled', async () => {
    const screen = await mount(Textarea, {
      props: { invalid: true, disabled: true },
      attrs: { ...HTML, 'id': 'screen-html', 'aria-describedby': 'screen-html-error' },
    })
    const textarea = screen.getByRole('textbox', { name: 'HTML' })

    await expect.element(textarea).toHaveAttribute('id', 'screen-html')
    await expect.element(textarea).toHaveAttribute('aria-describedby', 'screen-html-error')
    await expect.element(textarea).toHaveAttribute('aria-invalid', 'true')
    await expect.element(textarea).toBeDisabled()
  })

  it('is accessible and does not overflow in every state', async () => {
    await mount(TextareaGallery)

    await expectAccessible()
    await expectNoHorizontalOverflow()
  })
})
