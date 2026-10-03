import { describe, expect, it, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import { defineComponent, h, ref } from 'vue'
import { expectAccessible } from '@/testing/a11y'
import { withCoarsePointer } from '@/testing/media'
import { mount } from '@/testing/mount'
import { expectNoHorizontalOverflow } from '@/testing/overflow'
import SelectGallery from '../Select.gallery.vue'
import Select from '../Select.vue'

const PALETTES = [
  { value: 'bw', label: '1-bit, black and white' },
  { value: 'gray-4', label: '2-bit, 4 greys' },
  { value: 'gray-16', label: '4-bit, 16 greys' },
  { value: 'color-6', label: 'Colour, 6 inks', disabled: true, reason: 'Not on TRMNL OG' },
]

const DEVICE_MODELS = ['TRMNL OG', 'TRMNL X', 'Kindle Paperwhite 3', 'Kindle Paperwhite 5', 'Kobo Libra 2', 'Kobo Clara HD', 'Inkplate 10', 'Inkplate 6', 'M5Paper S3']
  .map(label => ({ value: label.toLowerCase().replaceAll(' ', '-'), label }))

function chooserOf(options: object[], initial: string | null, extra: object = {}) {
  return defineComponent({
    emits: ['chosen'],
    setup(_, { emit, attrs }) {
      const value = ref(initial)
      return () => h(Select, {
        options,
        ...extra,
        ...attrs,
        'modelValue': value.value,
        'onUpdate:modelValue': (next: string | null) => {
          value.value = next
          emit('chosen', next)
        },
      } as never)
    },
  })
}

async function mountPalette(initial: string | null = 'gray-4') {
  const onChosen = vi.fn()
  const screen = await mount(chooserOf(PALETTES, initial, { 'aria-label': 'Palette', 'placeholder': 'Choose a Palette' }), { props: { onChosen } })
  return { screen, onChosen, trigger: screen.getByRole('combobox', { name: 'Palette' }) }
}

async function mountDeviceModel(initial: string | null = 'trmnl-og') {
  const onChosen = vi.fn()
  const screen = await mount(chooserOf(DEVICE_MODELS, initial, { 'aria-label': 'Device Model' }), { props: { onChosen } })
  return { screen, onChosen, input: screen.getByRole('combobox', { name: 'Device Model' }) }
}

describe('select', () => {
  it('shows the chosen option\'s label, or its placeholder while nothing is chosen', async () => {
    const { trigger } = await mountPalette()
    await expect.element(trigger).toHaveTextContent('2-bit, 4 greys')

    const empty = await mountPalette(null)
    await expect.element(empty.trigger.last()).toHaveTextContent('Choose a Palette')
  })

  it.for(['{Enter}', ' ', '{ArrowDown}', '{ArrowUp}'])('opens with %s, with the chosen option highlighted', async (key) => {
    const { screen, trigger } = await mountPalette()
    await userEvent.keyboard('{Tab}')
    await expect.element(trigger).toHaveFocus()
    // While the list is open everything else is hidden from assistive technology, the trigger too.
    const triggerElement = trigger.element()

    await userEvent.keyboard(key)

    await expect.element(screen.getByRole('listbox')).toBeVisible()
    await expect.element(triggerElement).toHaveAttribute('aria-expanded', 'true')
    await expect.element(screen.getByRole('option', { name: '2-bit, 4 greys' })).toHaveFocus()
    await expect.element(screen.getByRole('option', { name: '2-bit, 4 greys' })).toHaveAttribute('aria-selected', 'true')
  })

  it('opens on a click', async () => {
    const { screen, trigger } = await mountPalette()

    await trigger.click()

    await expect.element(screen.getByRole('listbox')).toBeVisible()
  })

  it('moves with the arrows and chooses with Enter, which closes the list and returns the focus', async () => {
    const { screen, onChosen, trigger } = await mountPalette()
    await userEvent.keyboard('{Tab}{Enter}')
    await expect.element(screen.getByRole('option', { name: '2-bit, 4 greys' })).toHaveFocus()

    await userEvent.keyboard('{ArrowDown}')
    await expect.element(screen.getByRole('option', { name: '4-bit, 16 greys' })).toHaveFocus()
    await userEvent.keyboard('{ArrowUp}')
    await expect.element(screen.getByRole('option', { name: '2-bit, 4 greys' })).toHaveFocus()
    await userEvent.keyboard('{ArrowUp}')
    await expect.element(screen.getByRole('option', { name: '1-bit, black and white' })).toHaveFocus()
    await userEvent.keyboard('{Enter}')

    expect(onChosen).toHaveBeenCalledExactlyOnceWith('bw')
    await expect.element(screen.getByRole('listbox')).not.toBeInTheDocument()
    await expect.element(trigger).toHaveTextContent('1-bit, black and white')
    await expect.element(trigger).toHaveFocus()
  })

  it('jumps to an option as its name is typed', async () => {
    const { screen } = await mountPalette()
    await userEvent.keyboard('{Tab}{Enter}')
    await expect.element(screen.getByRole('option', { name: '2-bit, 4 greys' })).toHaveFocus()

    await userEvent.keyboard('4')

    await expect.element(screen.getByRole('option', { name: '4-bit, 16 greys' })).toHaveFocus()
  })

  it('closes on Escape without choosing and returns the focus', async () => {
    const { screen, onChosen, trigger } = await mountPalette()
    await userEvent.keyboard('{Tab}{Enter}')
    await expect.element(screen.getByRole('option', { name: '2-bit, 4 greys' })).toHaveFocus()
    await userEvent.keyboard('{ArrowDown}')

    await userEvent.keyboard('{Escape}')

    await expect.element(screen.getByRole('listbox')).not.toBeInTheDocument()
    await expect.element(trigger).toHaveFocus()
    expect(onChosen).not.toHaveBeenCalled()
  })

  it('chooses with a click', async () => {
    const { screen, onChosen, trigger } = await mountPalette()
    await trigger.click()

    await screen.getByRole('option', { name: '4-bit, 16 greys' }).click()

    expect(onChosen).toHaveBeenCalledExactlyOnceWith('gray-16')
    await expect.element(screen.getByRole('listbox')).not.toBeInTheDocument()
  })

  it('shows why an option is disabled and does not let it be chosen, by pointer or by keyboard', async () => {
    const { screen, onChosen } = await mountPalette('gray-16')
    await userEvent.keyboard('{Tab}{Enter}')
    const disabled = screen.getByRole('option', { name: 'Colour, 6 inks' })

    await expect.element(disabled).toHaveAttribute('aria-disabled', 'true')
    await expect.element(disabled).toHaveAccessibleDescription('Not on TRMNL OG')
    await expect.element(screen.getByText('Not on TRMNL OG')).toBeVisible()

    await userEvent.keyboard('{ArrowDown}')
    await expect.element(screen.getByRole('option', { name: '4-bit, 16 greys' })).toHaveFocus()
    await disabled.click({ force: true })

    expect(onChosen).not.toHaveBeenCalled()
    await expect.element(screen.getByRole('listbox')).toBeVisible()
  })

  it('draws the open list with an ink border and the highlighted option in solid ink', async () => {
    const { screen } = await mountPalette()
    await userEvent.keyboard('{Tab}{Enter}')
    const highlighted = screen.getByRole('option', { name: '2-bit, 4 greys' })
    await expect.element(highlighted).toHaveFocus()

    await expect.element(highlighted).toHaveStyle({ backgroundColor: 'rgb(18, 18, 18)', color: 'rgb(255, 255, 255)' })
    const list = highlighted.element().parentElement!
    expect(getComputedStyle(list).border).toBe('1px solid rgb(18, 18, 18)')
    expect(getComputedStyle(list).boxShadow).toBe('none')
  })

  it('does not open while disabled', async () => {
    const screen = await mount(Select, { props: { options: PALETTES, modelValue: 'bw', disabled: true }, attrs: { 'aria-label': 'Palette' } })
    const trigger = screen.getByRole('combobox', { name: 'Palette' })

    await expect.element(trigger).toBeDisabled()
    await trigger.click({ force: true })

    await expect.element(screen.getByRole('listbox')).not.toBeInTheDocument()
  })

  it('forwards its id and its description to the control and marks an invalid choice', async () => {
    const screen = await mount(Select, {
      props: { options: PALETTES, invalid: true },
      attrs: { 'aria-label': 'Palette', 'id': 'palette', 'aria-describedby': 'palette-error' },
    })
    const trigger = screen.getByRole('combobox', { name: 'Palette' })

    await expect.element(trigger).toHaveAttribute('id', 'palette')
    await expect.element(trigger).toHaveAttribute('aria-describedby', 'palette-error')
    await expect.element(trigger).toHaveAttribute('aria-invalid', 'true')
  })

  it('is 32 px high, and 44 px with 16 px text at a coarse pointer', async () => {
    const { trigger } = await mountPalette()

    expect(trigger.element().getBoundingClientRect().height).toBe(32)
    await withCoarsePointer(async () => {
      expect(trigger.element().getBoundingClientRect().height).toBe(44)
      expect(getComputedStyle(trigger.element()).fontSize).toBe('16px')
    })
  })

  describe('with a long list', () => {
    it('is an input holding the chosen option\'s label', async () => {
      const { input } = await mountDeviceModel()

      expect(input.element().localName).toBe('input')
      await expect.element(input).toHaveValue('TRMNL OG')
    })

    it('opens with the arrow keys and on a click, listing every option', async () => {
      const { screen, input } = await mountDeviceModel()
      await userEvent.keyboard('{Tab}')
      await expect.element(input).toHaveFocus()

      await userEvent.keyboard('{ArrowDown}')
      await expect.element(screen.getByRole('listbox')).toBeVisible()
      expect(screen.getByRole('option').elements()).toHaveLength(DEVICE_MODELS.length)

      await userEvent.keyboard('{Escape}')
      await expect.element(screen.getByRole('listbox')).not.toBeInTheDocument()
      await expect.element(input).toHaveFocus()

      await input.click()
      await expect.element(screen.getByRole('listbox')).toBeVisible()
    })

    it('filters as the admin types, and chooses the highlighted option with Enter', async () => {
      const { screen, onChosen, input } = await mountDeviceModel()

      await input.fill('kindle')

      await expect.element(screen.getByRole('option', { name: 'Kindle Paperwhite 3' })).toBeVisible()
      await expect.element(screen.getByRole('option', { name: 'Kindle Paperwhite 5' })).toBeVisible()
      expect(screen.getByRole('option').elements()).toHaveLength(2)

      await userEvent.keyboard('{ArrowDown}{Enter}')

      expect(onChosen).toHaveBeenCalledExactlyOnceWith('kindle-paperwhite-5')
      await expect.element(screen.getByRole('listbox')).not.toBeInTheDocument()
      await expect.element(input).toHaveValue('Kindle Paperwhite 5')
      await expect.element(input).toHaveFocus()
    })

    it('says so when nothing matches, and goes back to the chosen option when the search is abandoned', async () => {
      const { screen, onChosen, input } = await mountDeviceModel()

      await input.fill('nook')
      await expect.element(screen.getByText('Nothing matches')).toBeVisible()
      expect(screen.getByRole('option').elements()).toHaveLength(0)

      await userEvent.keyboard('{Escape}')

      await expect.element(input).toHaveValue('TRMNL OG')
      expect(onChosen).not.toHaveBeenCalled()
    })

    it('shows why an option is disabled and does not let it be chosen', async () => {
      const onUpdate = vi.fn()
      const screen = await mount(Select, {
        props: { 'options': PALETTES, 'modelValue': 'bw', 'filter': true, 'onUpdate:modelValue': onUpdate },
        attrs: { 'aria-label': 'Palette' },
      })
      await screen.getByRole('combobox', { name: 'Palette' }).click()
      const disabled = screen.getByRole('option', { name: 'Colour, 6 inks', exact: true })

      await expect.element(disabled).toHaveAttribute('aria-disabled', 'true')
      await expect.element(disabled).toHaveAccessibleDescription('Not on TRMNL OG')
      await disabled.click({ force: true })

      expect(onUpdate).not.toHaveBeenCalled()
    })

    it('can be made a combobox for a short list, and a plain list for a long one', async () => {
      const short = await mount(Select, { props: { options: PALETTES, modelValue: 'bw', filter: true }, attrs: { 'aria-label': 'Palette' } })
      expect(short.getByRole('combobox', { name: 'Palette' }).element().localName).toBe('input')

      const long = await mount(Select, { props: { options: DEVICE_MODELS, modelValue: 'trmnl-x', filter: false }, attrs: { 'aria-label': 'Device Model' } })
      expect(long.getByRole('combobox', { name: 'Device Model' }).element().localName).toBe('button')
    })

    it('forwards its id and its description to the input, marks an invalid choice and can be disabled', async () => {
      const screen = await mount(Select, {
        props: { options: DEVICE_MODELS, invalid: true, disabled: true },
        attrs: { 'aria-label': 'Device Model', 'id': 'device-model', 'aria-describedby': 'device-model-error' },
      })
      const input = screen.getByRole('combobox', { name: 'Device Model' })

      await expect.element(input).toHaveAttribute('id', 'device-model')
      await expect.element(input).toHaveAttribute('aria-describedby', 'device-model-error')
      await expect.element(input).toHaveAttribute('aria-invalid', 'true')
      await expect.element(input).toBeDisabled()
    })
  })

  it('has an accessible open list, as a list and as a combobox', async () => {
    const { screen } = await mountPalette()
    await userEvent.keyboard('{Tab}{Enter}')
    // Reka hides the page behind an open list from assistive technology, the focusable trigger included, so axe is given the list.
    await expectAccessible(screen.getByRole('listbox').element())
    await userEvent.keyboard('{Escape}')

    const long = await mountDeviceModel()
    await long.input.fill('kindle')
    await expectAccessible(long.screen.getByRole('listbox').element())
  })

  it('is accessible and does not overflow in every state', async () => {
    await mount(SelectGallery)

    await expectAccessible()
    await expectNoHorizontalOverflow()
  })
})
