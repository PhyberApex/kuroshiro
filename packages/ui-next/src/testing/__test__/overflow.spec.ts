import { describe, expect, it } from 'vitest'
import { mount } from '../mount'
import { expectNoHorizontalOverflow } from '../overflow'
import DisclosureExample from './examples/DisclosureExample.vue'
import WideExample from './examples/WideExample.vue'

describe('expectNoHorizontalOverflow', () => {
  it('passes a component that fits at 375, 768 and 1280 px', async () => {
    await mount(DisclosureExample)

    await expectNoHorizontalOverflow()
  })

  it('fails at the widths a 900 px element does not fit, and names the element', async () => {
    await mount(WideExample)

    const failure = await expectNoHorizontalOverflow().catch((error: Error) => error.message)

    expect(failure).toContain('Horizontal overflow at 375px')
    expect(failure).toContain('Horizontal overflow at 768px')
    expect(failure).not.toContain('at 1280px')
    expect(failure).toContain('<div.ruler> ends at 900px')
  })

  it('leaves the page at desktop width', async () => {
    await mount(WideExample)

    await expectNoHorizontalOverflow().catch(() => {})

    expect(window.innerWidth).toBe(1280)
  })
})
