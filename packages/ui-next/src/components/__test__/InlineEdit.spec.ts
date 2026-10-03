import { describe, expect, it, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import { defineComponent, h, ref } from 'vue'
import { expectAccessible } from '@/testing/a11y'
import { withCoarsePointer } from '@/testing/media'
import { mount } from '@/testing/mount'
import { expectNoHorizontalOverflow } from '@/testing/overflow'
import InlineEditGallery from '../InlineEdit.gallery.vue'
import InlineEdit from '../InlineEdit.vue'

function needsName(value: string) {
  return value.trim() ? undefined : 'A Screen needs a name.'
}

/** A Screen row's name with its "Rename" button, the way a page uses the inline edit. */
const ScreenName = defineComponent({
  props: { saving: Boolean, closeOnSave: { type: Boolean, default: true } },
  emits: ['save'],
  setup(props, { emit }) {
    const editing = ref(false)
    return () => h('div', [
      h(InlineEdit, {
        'value': 'Weather',
        'label': 'Name of Weather',
        'validate': needsName,
        'saving': props.saving,
        'editing': editing.value,
        'onUpdate:editing': (value: boolean) => editing.value = value,
        'onSave': (value: string) => {
          emit('save', value)
          editing.value = !props.closeOnSave
        },
      }),
      h('button', { type: 'button', onClick: () => editing.value = true }, 'Rename'),
    ])
  },
})

async function startRenaming(props: object = {}) {
  const onSave = vi.fn()
  const screen = await mount(ScreenName, { props: { onSave, ...props } })
  await screen.getByRole('button', { name: 'Rename' }).click()
  return { screen, onSave, input: screen.getByRole('textbox', { name: 'Name of Weather' }) }
}

describe('inline edit', () => {
  it('shows the value until it is edited', async () => {
    const screen = await mount(ScreenName)

    await expect.element(screen.getByText('Weather')).toBeVisible()
    await expect.element(screen.getByRole('textbox')).not.toBeInTheDocument()
  })

  it('turns into a focused input holding the value, selected, with "Save" and "Cancel"', async () => {
    const { screen, input } = await startRenaming()

    await expect.element(input).toHaveFocus()
    await expect.element(input).toHaveValue('Weather')
    expect(getSelection()?.toString()).toBe('Weather')
    await expect.element(screen.getByRole('button', { name: 'Save' })).toBeVisible()
    await expect.element(screen.getByRole('button', { name: 'Cancel' })).toBeVisible()
  })

  it('saves on Enter and returns the focus to what started the editing', async () => {
    const { screen, onSave } = await startRenaming()

    await userEvent.keyboard('Forecast{Enter}')

    expect(onSave).toHaveBeenCalledExactlyOnceWith('Forecast')
    await expect.element(screen.getByRole('textbox')).not.toBeInTheDocument()
    await expect.element(screen.getByRole('button', { name: 'Rename' })).toHaveFocus()
  })

  it('saves on "Save"', async () => {
    const { screen, onSave, input } = await startRenaming()

    await input.fill('Forecast')
    await screen.getByRole('button', { name: 'Save' }).click()

    expect(onSave).toHaveBeenCalledExactlyOnceWith('Forecast')
  })

  it.for(['{Escape}', 'Cancel'] as const)('cancels on %s: nothing is emitted and the focus returns', async (how) => {
    const { screen, onSave, input } = await startRenaming()
    await input.fill('Forecast')

    if (how === 'Cancel')
      await screen.getByRole('button', { name: 'Cancel' }).click()
    else
      await userEvent.keyboard(how)

    expect(onSave).not.toHaveBeenCalled()
    await expect.element(screen.getByRole('textbox')).not.toBeInTheDocument()
    await expect.element(screen.getByText('Weather')).toBeVisible()
    await expect.element(screen.getByRole('button', { name: 'Rename' })).toHaveFocus()
  })

  it('starts from the value again after a cancelled edit', async () => {
    const { screen, input } = await startRenaming()
    await input.fill('Forecast')
    await userEvent.keyboard('{Escape}')

    await screen.getByRole('button', { name: 'Rename' }).click()

    await expect.element(screen.getByRole('textbox', { name: 'Name of Weather' })).toHaveValue('Weather')
  })

  it('does not emit an invalid value: it stays open, says what is wrong and marks the input', async () => {
    const { screen, onSave, input } = await startRenaming()

    await input.fill('  ')
    await userEvent.keyboard('{Enter}')

    expect(onSave).not.toHaveBeenCalled()
    await expect.element(input).toHaveAttribute('aria-invalid', 'true')
    await expect.element(input).toHaveAccessibleDescription('A Screen needs a name.')
    await expect.element(screen.getByText('A Screen needs a name.')).toBeVisible()
    await expect.element(input).toHaveFocus()

    await screen.getByRole('button', { name: 'Save' }).click()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('drops the message once the value is changed, and saves a corrected one', async () => {
    const { screen, onSave, input } = await startRenaming()
    await input.fill('')
    await userEvent.keyboard('{Enter}')
    await expect.element(screen.getByText('A Screen needs a name.')).toBeVisible()

    await input.fill('Forecast')
    await expect.element(screen.getByText('A Screen needs a name.')).not.toBeInTheDocument()
    await expect.element(input).not.toHaveAttribute('aria-invalid')

    await userEvent.keyboard('{Enter}')
    expect(onSave).toHaveBeenCalledExactlyOnceWith('Forecast')
  })

  it('closes without saving when the value was not changed', async () => {
    const { screen, onSave } = await startRenaming()

    await userEvent.keyboard('{Enter}')

    expect(onSave).not.toHaveBeenCalled()
    await expect.element(screen.getByRole('textbox')).not.toBeInTheDocument()
    await expect.element(screen.getByRole('button', { name: 'Rename' })).toHaveFocus()
  })

  it('while saving shows the loading mark on "Save" and takes no second save and no cancel', async () => {
    const { screen, onSave, input } = await startRenaming({ closeOnSave: false })
    await input.fill('Forecast')
    await userEvent.keyboard('{Enter}')
    await screen.rerender({ saving: true })

    await expect.element(screen.getByRole('button', { name: 'Save' })).toHaveAttribute('aria-busy', 'true')
    await expect.element(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
    await expect.element(input).toHaveAttribute('readonly')

    await input.click()
    await userEvent.keyboard('{Enter}')
    await userEvent.keyboard('{Escape}')

    expect(onSave).toHaveBeenCalledTimes(1)
    await expect.element(input).toBeVisible()
  })

  it('shows a refusal from the server like one of its own', async () => {
    const screen = await mount(InlineEdit, {
      props: { editing: true, value: 'Weather', label: 'Name of Weather', error: 'Another Screen is called Weather.' },
    })
    const input = screen.getByRole('textbox', { name: 'Name of Weather' })

    await expect.element(input).toHaveAttribute('aria-invalid', 'true')
    await expect.element(input).toHaveAccessibleDescription('Another Screen is called Weather.')
  })

  it('is 32 px high, and 44 px with 16 px text at a coarse pointer', async () => {
    const { input } = await startRenaming()

    expect(input.element().getBoundingClientRect().height).toBe(32)
    await withCoarsePointer(async () => {
      expect(input.element().getBoundingClientRect().height).toBe(44)
      expect(getComputedStyle(input.element()).fontSize).toBe('16px')
    })
  })

  it('is accessible and does not overflow in every state', async () => {
    await mount(InlineEditGallery)

    await expectAccessible()
    await expectNoHorizontalOverflow()
  })
})
