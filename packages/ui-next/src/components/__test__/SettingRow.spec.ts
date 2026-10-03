import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { expectAccessible } from '@/testing/a11y'
import { mount } from '@/testing/mount'
import { expectNoHorizontalOverflow } from '@/testing/overflow'
import { elementsInSealColour } from '@/testing/sealColour'
import { resetViewport, resizeTo } from '@/testing/viewport'
import SettingRowGallery from '../SettingRow.gallery.vue'
import SettingRow from '../SettingRow.vue'
import TextInput from '../TextInput.vue'

function rowOf(props: object, note?: string) {
  return defineComponent(() => () => h(SettingRow, { label: 'Name', ...props }, {
    default: ({ control }: { control: object }) => h(TextInput, { modelValue: 'Kitchen', ...control }),
    ...(note ? { note: () => note } : {}),
  }))
}

describe('setting row', () => {
  it('names its control by its label', async () => {
    const screen = await mount(rowOf({}))

    await expect.element(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Kitchen')
  })

  it('describes the control by the note under it', async () => {
    const screen = await mount(rowOf({}, 'Shown in the Masthead.'))

    await expect.element(screen.getByRole('textbox', { name: 'Name' })).toHaveAccessibleDescription('Shown in the Masthead.')
  })

  it('marks the control invalid and says what is wrong above the note, which stays', async () => {
    const screen = await mount(rowOf({ error: 'Enter a name.' }, 'Shown in the Masthead.'))
    const input = screen.getByRole('textbox', { name: 'Name' })

    await expect.element(input).toHaveAttribute('aria-invalid', 'true')
    await expect.element(input).toHaveAccessibleDescription('Enter a name. Shown in the Masthead.')
    await expect.element(screen.getByText('Shown in the Masthead.')).toBeVisible()
  })

  it('shows where the save stands at its side', async () => {
    const screen = await mount(rowOf({ status: 'saving' }))
    const input = screen.getByRole('textbox', { name: 'Name' }).element()
    const state = screen.getByRole('status')

    await expect.element(state).toHaveTextContent('Saving')
    expect(state.element().getBoundingClientRect().left).toBeGreaterThan(input.getBoundingClientRect().right)
  })

  it('says why a save failed under the control, in ink, and hands "Try again" on', async () => {
    const onRetry = vi.fn()
    const screen = await mount(rowOf({ status: 'failed', reason: 'Kuroshiro\'s server is not answering.', onRetry }))
    const input = screen.getByRole('textbox', { name: 'Name' }).element().getBoundingClientRect()
    const state = screen.getByRole('status').element().getBoundingClientRect()

    await expect.element(screen.getByRole('status')).toHaveTextContent('Not saved. Kuroshiro\'s server is not answering.')
    expect(state.top).toBeGreaterThanOrEqual(input.bottom)
    expect(state.left).toBe(input.left)
    expect(elementsInSealColour(screen.container)).toEqual([])
    await screen.getByRole('button', { name: 'Try again' }).click()

    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('names a group of controls through the label\'s id', async () => {
    const screen = await mount(SettingRowGallery)

    await expect.element(screen.getByRole('group', { name: 'Days' })).toBeVisible()
  })

  it('stacks into one column on a phone', async () => {
    const screen = await mount(rowOf({ status: 'saved' }, 'Shown in the Masthead.'))
    const top = (element: Element) => element.getBoundingClientRect().top

    await resizeTo(375)
    try {
      const label = screen.getByText('Name', { exact: true }).element()
      const input = screen.getByRole('textbox', { name: 'Name' }).element()
      expect(top(input)).toBeGreaterThan(top(label))
      expect(top(screen.getByRole('status').element())).toBeGreaterThan(top(input))
    }
    finally {
      await resetViewport()
    }
  })

  it('is accessible and does not overflow in every state', async () => {
    await mount(SettingRowGallery)

    await expectAccessible()
    await expectNoHorizontalOverflow()
  })
})
