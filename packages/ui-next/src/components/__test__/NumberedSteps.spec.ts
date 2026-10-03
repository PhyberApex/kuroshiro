import { describe, expect, it } from 'vitest'
import { h } from 'vue'
import { expectAccessible } from '@/testing/a11y'
import { mount } from '@/testing/mount'
import { expectNoHorizontalOverflow } from '@/testing/overflow'
import NumberedStepsGallery from '../NumberedSteps.gallery.vue'
import NumberedSteps from '../NumberedSteps.vue'

const STEPS = ['Hold the button for five seconds.', 'Join the Wi-Fi network the Device opens.', 'Enter the Server URL.']

function mountSteps() {
  return mount(NumberedSteps, { slots: { default: () => STEPS.map(step => h('li', step)) } })
}

const numberOf = (step: Element) => getComputedStyle(step, '::before')

describe('numbered steps', () => {
  it('is an ordered list of the steps it is given', async () => {
    const screen = await mountSteps()
    const list = screen.getByRole('list')

    expect(list.element().localName).toBe('ol')
    expect(list.getByRole('listitem').elements().map(step => step.textContent)).toEqual(STEPS)
  })

  it('numbers each step in mono, beside its text and not over it', async () => {
    const screen = await mountSteps()
    const steps = screen.getByRole('listitem').elements()

    expect(steps.map(step => numberOf(step).content)).toEqual(['counter(step)', 'counter(step)', 'counter(step)'])
    expect(numberOf(steps[0]).fontFamily).toContain('JetBrains Mono')
    expect(Number.parseFloat(getComputedStyle(steps[0]).paddingLeft)).toBeGreaterThanOrEqual(Number.parseFloat(numberOf(steps[0]).width) + 12)
  })

  it('rules off every step, the first one above as well', async () => {
    const screen = await mountSteps()
    const [first, second] = screen.getByRole('listitem').elements().map(step => getComputedStyle(step))

    await expect.poll(() => [first.borderTopWidth, first.borderBottomWidth]).toEqual(['1px', '1px'])
    expect([second.borderTopWidth, second.borderBottomWidth]).toEqual(['0px', '1px'])
  })

  it('is accessible and does not overflow', async () => {
    await mount(NumberedStepsGallery)

    await expectAccessible()
    await expectNoHorizontalOverflow()
  })
})
