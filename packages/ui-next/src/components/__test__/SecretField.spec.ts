import { describe, expect, it, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import { defineComponent, h, ref } from 'vue'
import { expectAccessible } from '@/testing/a11y'
import { mount } from '@/testing/mount'
import { expectNoHorizontalOverflow } from '@/testing/overflow'
import SecretFieldGallery from '../SecretField.gallery.vue'
import SecretField from '../SecretField.vue'

const API_KEY = { 'aria-label': 'API key', 'placeholder': 'Not set' }

const StoredApiKey = defineComponent({
  emits: ['typed'],
  setup(_, { emit }) {
    const secret = ref('')
    return () => h(SecretField, {
      ...API_KEY,
      'stored': true,
      'replaceLabel': 'Replace API key',
      'modelValue': secret.value,
      'onUpdate:modelValue': (value: string) => {
        secret.value = value
        emit('typed', value)
      },
    })
  },
})

describe('secret field', () => {
  it('is an empty password input when nothing is stored', async () => {
    const screen = await mount(SecretField, { attrs: API_KEY })
    const input = screen.getByLabelText('API key')

    await expect.element(input).toHaveAttribute('type', 'password')
    await expect.element(input).toHaveValue('')
    await expect.element(input).toHaveAttribute('placeholder', 'Not set')
    await expect.element(screen.getByRole('button')).not.toBeInTheDocument()
  })

  it('reports what is typed and never shows it', async () => {
    const onUpdate = vi.fn()
    const screen = await mount(SecretField, { props: { 'onUpdate:modelValue': onUpdate }, attrs: API_KEY })

    await screen.getByLabelText('API key').fill('kuro_live_9f2c')

    expect(onUpdate).toHaveBeenLastCalledWith('kuro_live_9f2c')
    await expect.element(screen.getByLabelText('API key')).toHaveAttribute('type', 'password')
  })

  it('with a stored value shows dots and "Replace", and holds no input and no value', async () => {
    const screen = await mount(StoredApiKey)

    await expect.element(screen.getByRole('button', { name: 'Replace API key' })).toHaveTextContent('Replace')
    await expect.element(screen.getByRole('button', { name: 'Replace API key' }))
      .toHaveAccessibleDescription('A value is stored and is not shown.')
    await expect.element(screen.getByText('••••••••••••')).toBeVisible()
    expect(screen.container.querySelector('input')).toBeNull()
  })

  it('"Replace" gives an empty, focused password input', async () => {
    const screen = await mount(StoredApiKey)

    await screen.getByRole('button', { name: 'Replace API key' }).click()

    const input = screen.getByLabelText('API key')
    await expect.element(input).toHaveFocus()
    await expect.element(input).toHaveValue('')
    await expect.element(input).toHaveAttribute('type', 'password')
    await expect.element(screen.getByRole('button')).not.toBeInTheDocument()
  })

  it('works by keyboard, and leaving the input empty restores the stored state', async () => {
    const screen = await mount(StoredApiKey)

    await userEvent.keyboard('{Tab}')
    await expect.element(screen.getByRole('button', { name: 'Replace API key' })).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    await expect.element(screen.getByLabelText('API key')).toHaveFocus()

    await userEvent.keyboard('{Tab}')

    await expect.element(screen.getByRole('button', { name: 'Replace API key' })).toBeVisible()
    expect(screen.container.querySelector('input')).toBeNull()
  })

  it('keeps a replacement that was typed when the input is left', async () => {
    const onTyped = vi.fn()
    const screen = await mount(StoredApiKey, { props: { onTyped } })
    await screen.getByRole('button', { name: 'Replace API key' }).click()

    await screen.getByLabelText('API key').fill('kuro_live_new')
    await userEvent.keyboard('{Tab}')

    expect(onTyped).toHaveBeenLastCalledWith('kuro_live_new')
    await expect.element(screen.getByLabelText('API key')).toHaveValue('kuro_live_new')
    await expect.element(screen.getByRole('button')).not.toBeInTheDocument()
  })

  it('goes back to dots once the replacement is saved and cleared', async () => {
    const screen = await mount(SecretField, { props: { stored: true, modelValue: 'kuro_live_new' }, attrs: API_KEY })
    await expect.element(screen.getByLabelText('API key')).toHaveValue('kuro_live_new')

    await screen.rerender({ modelValue: '' })

    await expect.element(screen.getByRole('button', { name: 'Replace' })).toBeVisible()
    expect(screen.container.querySelector('input')).toBeNull()
  })

  it('cannot be replaced while disabled', async () => {
    const screen = await mount(SecretField, { props: { stored: true, disabled: true }, attrs: API_KEY })

    await expect.element(screen.getByRole('button', { name: 'Replace' })).toBeDisabled()
  })

  it('forwards its id and its description to the input and marks an invalid value', async () => {
    const screen = await mount(SecretField, {
      props: { invalid: true },
      attrs: { ...API_KEY, 'id': 'api-key', 'aria-describedby': 'api-key-error' },
    })
    const input = screen.getByLabelText('API key')

    await expect.element(input).toHaveAttribute('id', 'api-key')
    await expect.element(input).toHaveAttribute('aria-describedby', 'api-key-error')
    await expect.element(input).toHaveAttribute('aria-invalid', 'true')
  })

  it('is accessible and does not overflow in every state', async () => {
    await mount(SecretFieldGallery)

    await expectAccessible()
    await expectNoHorizontalOverflow()
  })
})
