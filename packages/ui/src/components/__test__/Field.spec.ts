import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { expectAccessible } from '@/testing/a11y'
import { mount } from '@/testing/mount'
import { expectNoHorizontalOverflow } from '@/testing/overflow'
import { forceTheme, THEMES } from '@/testing/theme'
import FieldGallery from '../Field.gallery.vue'
import Field from '../Field.vue'
import NumberInput from '../NumberInput.vue'

const RefreshRate = defineComponent({
  props: { hint: String, error: String, id: String, optional: Boolean },
  setup: props => () => h(Field, { label: 'Refresh rate', ...props }, {
    default: ({ control }: { control: object }) => h(NumberInput, { modelValue: 12, ...control }),
  }),
})

function isGrey(colour: string) {
  const [red, green, blue] = colour.match(/[\d.]+/g)!.map(Number)
  return red === green && green === blue
}

describe('field', () => {
  it('names the control with its label, and a click on the label focuses the control', async () => {
    const screen = await mount(RefreshRate)

    await screen.getByText('Refresh rate').click()

    await expect.element(screen.getByRole('spinbutton', { name: 'Refresh rate' })).toHaveFocus()
  })

  it('marks a control that may be left empty as optional, in its label', async () => {
    const screen = await mount(RefreshRate, { props: { optional: true } })

    await expect.element(screen.getByRole('spinbutton', { name: 'Refresh rate optional' })).toBeVisible()
  })

  it('describes the control with its hint', async () => {
    const screen = await mount(RefreshRate, { props: { hint: 'Seconds between two polls.' } })
    const input = screen.getByRole('spinbutton', { name: 'Refresh rate' })

    await expect.element(input).toHaveAccessibleDescription('Seconds between two polls.')
    await expect.element(input).not.toHaveAttribute('aria-invalid')
  })

  it('leaves a control without hint or error undescribed', async () => {
    const screen = await mount(RefreshRate)

    await expect.element(screen.getByRole('spinbutton', { name: 'Refresh rate' })).not.toHaveAttribute('aria-describedby')
  })

  it('in error marks the control invalid and describes it with the message, which takes the hint\'s place', async () => {
    const screen = await mount(RefreshRate, {
      props: { hint: 'Seconds between two polls.', error: 'The shortest refresh rate is 60 seconds.' },
    })
    const input = screen.getByRole('spinbutton', { name: 'Refresh rate' })

    await expect.element(input).toHaveAttribute('aria-invalid', 'true')
    await expect.element(input).toHaveAccessibleDescription('The shortest refresh rate is 60 seconds.')
    await expect.element(screen.getByText('Seconds between two polls.')).not.toBeInTheDocument()
  })

  it('announces the error when it appears: the message lands in a live region that was already there', async () => {
    const screen = await mount(RefreshRate, { props: { hint: 'Seconds between two polls.' } })
    const liveRegion = screen.container.querySelector<HTMLElement>('[aria-live="polite"]')!
    expect(liveRegion).toBeEmptyDOMElement()

    await screen.rerender({ error: 'The shortest refresh rate is 60 seconds.' })

    await expect.element(liveRegion).toHaveTextContent('The shortest refresh rate is 60 seconds.')
    expect(screen.container.querySelector('[aria-live="polite"]')).toBe(liveRegion)
  })

  it('draws an error in ink with the problem icon and a doubled border, never in red', async () => {
    const screen = await mount(RefreshRate, { props: { error: 'The shortest refresh rate is 60 seconds.' } })
    const input = screen.getByRole('spinbutton', { name: 'Refresh rate' }).element()
    const message = screen.getByText('The shortest refresh rate is 60 seconds.').element()

    expect(message.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    for (const theme of THEMES) {
      await forceTheme(theme)
      const { borderTopColor, boxShadow } = getComputedStyle(input)
      expect(boxShadow, theme).toContain('0px 0px 0px 1px inset')
      expect([borderTopColor, getComputedStyle(message).color].every(isGrey), theme).toBe(true)
      expect(boxShadow.startsWith(borderTopColor), theme).toBe(true)
    }
  })

  it('uses the id it is given', async () => {
    const screen = await mount(RefreshRate, { props: { id: 'refresh-rate', hint: 'Seconds between two polls.' } })

    await expect.element(screen.getByRole('spinbutton', { name: 'Refresh rate' })).toHaveAttribute('id', 'refresh-rate')
  })

  it('is accessible and does not overflow in every state', async () => {
    await mount(FieldGallery)

    await expectAccessible()
    await expectNoHorizontalOverflow()
  })
})
