import { describe, expect, it, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import { expectAccessible } from '@/testing/a11y'
import { mount } from '@/testing/mount'
import { expectNoHorizontalOverflow } from '@/testing/overflow'
import ColourRowGallery from '../ColourRow.gallery.vue'
import ColourRow from '../ColourRow.vue'

const swatchOf = (container: Element) => container.querySelector<HTMLElement>('.colour-swatch')!

describe('colour row', () => {
  it('shows the colour typed as its swatch, following what is typed', async () => {
    const onUpdate = vi.fn()
    const screen = await mount(ColourRow, { props: { 'modelValue': '#B53A30', 'label': 'Colour 2', 'onUpdate:modelValue': onUpdate } })
    onUpdate.mockImplementation(value => screen.rerender({ modelValue: value }))
    const input = screen.getByRole('textbox', { name: 'Colour 2' })
    await expect.element(input).toHaveValue('#B53A30')
    expect(getComputedStyle(swatchOf(screen.container)).backgroundColor).toBe('rgb(181, 58, 48)')

    await input.fill('#27407e')

    expect(onUpdate).toHaveBeenLastCalledWith('#27407e')
    await expect.poll(() => getComputedStyle(swatchOf(screen.container)).backgroundColor).toBe('rgb(39, 64, 126)')
  })

  it('shows no colour in its swatch while the value is not a whole #RRGGBB', async () => {
    const screen = await mount(ColourRow, { props: { modelValue: '#B53A', label: 'Colour 2' } })

    expect(getComputedStyle(swatchOf(screen.container)).backgroundColor).toBe('rgba(0, 0, 0, 0)')
    expect(swatchOf(screen.container).classList).toContain('unknown')
  })

  it('draws a 32 px swatch beside the input, hidden from assistive technology', async () => {
    const screen = await mount(ColourRow, { props: { modelValue: '#B53A30', label: 'Colour 2' } })
    const swatch = swatchOf(screen.container)

    await expect.poll(() => swatch.getBoundingClientRect().width).toBe(32)
    expect(swatch.getBoundingClientRect().height).toBe(32)
    expect(swatch.getAttribute('aria-hidden')).toBe('true')
  })

  it('sets the value in mono and marks an invalid one, passing its description to the input', async () => {
    const screen = await mount(ColourRow, { props: { modelValue: '#B53A', label: 'Colour 2', invalid: true }, attrs: { 'aria-describedby': 'colours-error' } })
    const input = screen.getByRole('textbox', { name: 'Colour 2' })

    await expect.element(input).toHaveAttribute('aria-invalid', 'true')
    await expect.element(input).toHaveAttribute('aria-describedby', 'colours-error')
    expect(getComputedStyle(input.element()).fontFamily).toContain('Mono')
  })

  it('is removed by its button, which names the colour, reached by Tab from the input and pressed with Enter or Space', async () => {
    const onRemove = vi.fn()
    const screen = await mount(ColourRow, { props: { modelValue: '#B53A30', label: 'Colour 2', onRemove } })

    await screen.getByRole('textbox', { name: 'Colour 2' }).click()
    await userEvent.keyboard('{Tab}')
    await expect.element(screen.getByRole('button', { name: 'Remove colour 2' })).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    await userEvent.keyboard(' ')

    expect(onRemove).toHaveBeenCalledTimes(2)
  })

  it('does not offer the browser\'s spelling or remembered values for a colour', async () => {
    const screen = await mount(ColourRow, { props: { modelValue: '#B53A30', label: 'Colour 2' } })
    const input = screen.getByRole('textbox', { name: 'Colour 2' })

    await expect.element(input).toHaveAttribute('spellcheck', 'false')
    await expect.element(input).toHaveAttribute('autocomplete', 'off')
  })

  it('is accessible and does not overflow', async () => {
    await mount(ColourRowGallery)

    await expectAccessible()
    await expectNoHorizontalOverflow()
  })
})
