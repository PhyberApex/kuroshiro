import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { expectAccessible } from '@/testing/a11y'
import { mount } from '@/testing/mount'
import { expectNoHorizontalOverflow } from '@/testing/overflow'
import { elementsInSealColour } from '@/testing/sealColour'
import ResultLine from '../ResultLine.gallery.vue'
import ResultLineComponent from '../ResultLine.vue'

describe('result line', () => {
  it('is a status with one sentence and the loading mark while the action runs', async () => {
    const screen = await mount(ResultLineComponent, { props: { running: true }, slots: { default: 'Sending the Test Notification' } })
    const line = screen.getByRole('status')

    await expect.element(line).toHaveTextContent('Sending the Test Notification')
    expect(line.element().querySelector('.loading-mark')).not.toBeNull()
    expect(line.element().querySelector('svg')).toBeNull()
  })

  it('is an empty status region until it is given a sentence, and says it in that region', async () => {
    const Line = defineComponent((props: { sentence?: string }) => () => h(ResultLineComponent, { running: true }, props.sentence ? { default: () => props.sentence } : {}), { props: ['sentence'] })
    const screen = await mount(Line)
    const region = screen.getByRole('status').element()
    expect(region).toBeEmptyDOMElement()

    await screen.rerender({ sentence: 'Sending the Test Notification' })

    await expect.element(screen.getByRole('status')).toHaveTextContent('Sending the Test Notification')
    expect(screen.getByRole('status').element()).toBe(region)
  })

  it('swaps the loading mark for an icon in the same region when the action is done', async () => {
    const screen = await mount(ResultLineComponent, { props: { running: true }, slots: { default: 'Sending the Test Notification' } })
    const region = screen.getByRole('status').element()

    await screen.rerender({ running: false })

    await expect.poll(() => region.querySelector('svg')).not.toBeNull()
    expect(region.querySelector('.loading-mark')).toBeNull()
    expect(screen.getByRole('status').element()).toBe(region)
  })

  it('keeps its marks out of what is read: the sentence says it all', async () => {
    const screen = await mount(ResultLine)

    const marks = screen.container.querySelectorAll('[role="status"] > :is(svg, .loading-mark)')
    expect(marks).toHaveLength(4)
    expect([...marks].every(mark => mark.getAttribute('aria-hidden') === 'true')).toBe(true)
  })

  it('is ink when the action did not work: the problem icon tells it, not the seal colour', async () => {
    const screen = await mount(ResultLine)

    expect(elementsInSealColour(screen.container)).toEqual([])
  })

  it('is accessible and does not overflow in every state', async () => {
    await mount(ResultLine)

    await expectAccessible()
    await expectNoHorizontalOverflow()
  })
})
