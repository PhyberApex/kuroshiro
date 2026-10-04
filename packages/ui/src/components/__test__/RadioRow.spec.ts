import type { RadioChoice } from '../RadioRow.vue'
import { describe, expect, it, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import { h } from 'vue'
import { expectAccessible } from '@/testing/a11y'
import { pressAndHold } from '@/testing/keys'
import { withCoarsePointer } from '@/testing/media'
import { mount } from '@/testing/mount'
import { expectNoHorizontalOverflow } from '@/testing/overflow'
import RadioRowGallery from '../RadioRow.gallery.vue'
import RadioRow from '../RadioRow.vue'

const KINDS: RadioChoice<string>[] = [
  { value: 'plugin', label: 'Plugin', hint: 'One of your Plugins, rendered for this Device' },
  { value: 'mashup', label: 'Mashup', hint: 'Several Plugins sharing one Screen in a layout' },
  { value: 'link', label: 'External link' },
]

async function mountRows(chosen: string | undefined, props: { choices?: RadioChoice<string>[], disabled?: boolean } = {}) {
  const onUpdate = vi.fn<(value: string) => void>()
  const screen = await mount(RadioRow, {
    props: { 'choices': KINDS, ...props, 'modelValue': chosen, 'onUpdate:modelValue': onUpdate },
    attrs: { 'aria-label': 'Kind' },
  })
  onUpdate.mockImplementation(value => screen.rerender({ modelValue: value }))
  return { screen, onUpdate }
}

describe('radio row', () => {
  it('is a named radio group whose rows are named by their name and described by their explanation', async () => {
    const { screen } = await mountRows('plugin')
    const group = screen.getByRole('radiogroup', { name: 'Kind' })

    await expect.element(group.getByRole('radio', { name: 'Plugin', exact: true })).toBeChecked()
    await expect.element(group.getByRole('radio', { name: 'Plugin', exact: true })).toHaveAccessibleDescription('One of your Plugins, rendered for this Device')
    await expect.element(group.getByRole('radio', { name: 'External link', exact: true })).toHaveAccessibleDescription('')
    await expect.element(group.getByRole('radio', { name: 'Mashup', exact: true })).not.toBeChecked()
  })

  it('renders what a choice holds under its row, between that row and the next', async () => {
    const screen = await mount(RadioRow, {
      props: { choices: KINDS, modelValue: 'plugin' },
      attrs: { 'aria-label': 'Kind' },
      slots: { under: ({ choice }: { choice: RadioChoice<string> }) => choice.value === 'plugin' ? h('p', 'Which Plugin?') : undefined },
    })

    const group = screen.getByRole('radiogroup', { name: 'Kind' }).element()
    expect([...group.children].map(child => child.getAttribute('role') ?? child.textContent)).toEqual(['radio', 'Which Plugin?', 'radio', 'radio'])
  })

  it('shows the code of a row beside its name in mono, and describes the row by it without renaming it', async () => {
    const choices: RadioChoice<string>[] = [
      { value: 'standard', label: 'Replace', code: 'standard', hint: 'Each POST replaces the Webhook Payload.' },
      { value: 'deep_merge', label: 'Deep merge', code: 'deep_merge' },
    ]
    const { screen } = await mountRows('standard', { choices })

    await expect.element(screen.getByRole('radio', { name: 'Replace', exact: true })).toHaveAccessibleDescription('standard Each POST replaces the Webhook Payload.')
    await expect.element(screen.getByRole('radio', { name: 'Deep merge', exact: true })).toHaveAccessibleDescription('deep_merge')
    const name = screen.getByText('Deep merge', { exact: true }).element().getBoundingClientRect()
    const code = screen.getByText('deep_merge', { exact: true }).element()
    expect(getComputedStyle(code).fontFamily).toBe(getComputedStyle(document.documentElement).getPropertyValue('--font-mono').trim())
    expect(code.getBoundingClientRect().left).toBeGreaterThan(name.right)
    expect(Math.abs(code.getBoundingClientRect().bottom - name.bottom)).toBeLessThan(4)
  })

  it('can start with nothing chosen, and chooses a row on a click anywhere on it', async () => {
    const { screen, onUpdate } = await mountRows(undefined)

    expect(screen.getByRole('radio', { checked: true }).elements()).toHaveLength(0)

    await screen.getByText('Several Plugins sharing one Screen in a layout').click()

    expect(onUpdate).toHaveBeenLastCalledWith('mashup')
    await expect.element(screen.getByRole('radio', { name: 'Mashup', exact: true })).toBeChecked()
  })

  it('is one Tab stop on the chosen row, and the arrow keys move and choose', async () => {
    const { screen, onUpdate } = await mountRows('mashup')

    await userEvent.keyboard('{Tab}')
    await expect.element(screen.getByRole('radio', { name: 'Mashup', exact: true })).toHaveFocus()

    await pressAndHold('ArrowDown')
    await expect.element(screen.getByRole('radio', { name: 'External link', exact: true })).toHaveFocus()
    await expect.element(screen.getByRole('radio', { name: 'External link', exact: true })).toBeChecked()
    expect(onUpdate).toHaveBeenLastCalledWith('link')

    await pressAndHold('ArrowUp')
    await expect.element(screen.getByRole('radio', { name: 'Mashup', exact: true })).toBeChecked()

    await userEvent.keyboard('{Tab}')
    expect(screen.getByRole('radiogroup').element().contains(document.activeElement)).toBe(false)
  })

  it('skips a disabled row', async () => {
    const choices = KINDS.map(choice => ({ ...choice, disabled: choice.value === 'mashup' }))
    const { screen, onUpdate } = await mountRows('plugin', { choices })

    await userEvent.keyboard('{Tab}')
    await pressAndHold('ArrowDown')

    await expect.element(screen.getByRole('radio', { name: 'External link', exact: true })).toBeChecked()

    await screen.getByRole('radio', { name: 'Mashup', exact: true }).click({ force: true })
    expect(onUpdate).toHaveBeenCalledExactlyOnceWith('link')
  })

  it('chooses nothing while the whole group is disabled', async () => {
    const { screen, onUpdate } = await mountRows('plugin', { disabled: true })

    await expect.element(screen.getByRole('radio', { name: 'Mashup', exact: true })).toBeDisabled()
    await screen.getByRole('radio', { name: 'Mashup', exact: true }).click({ force: true })

    expect(onUpdate).not.toHaveBeenCalled()
  })

  it('is at least a 44 px target, at a coarse pointer too', async () => {
    const { screen } = await mountRows('plugin')
    const bare = screen.getByRole('radio', { name: 'External link', exact: true }).element()

    expect(bare.getBoundingClientRect().height).toBeGreaterThanOrEqual(44)
    await withCoarsePointer(async () => {
      expect(bare.getBoundingClientRect().height).toBeGreaterThanOrEqual(44)
    })
  })

  it('is accessible and does not overflow in every state', async () => {
    await mount(RadioRowGallery)

    await expectAccessible()
    await expectNoHorizontalOverflow()
  })
})
