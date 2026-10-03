import { describe, expect, it } from 'vitest'
import { expectAccessible } from '../a11y'
import { mount } from '../mount'
import DisclosureExample from './examples/DisclosureExample.vue'
import LowContrastExample from './examples/LowContrastExample.vue'

describe('expectAccessible', () => {
  it('passes a component that meets WCAG 2.1 AA in both themes', async () => {
    await mount(DisclosureExample)

    await expectAccessible()
  })

  it('fails text whose contrast is too low, and names the theme and the rule', async () => {
    await mount(LowContrastExample)

    await expect(expectAccessible()).rejects.toThrow(/light theme:\n\s+color-contrast[\s\S]+dark theme:\n\s+color-contrast/)
  })
})
