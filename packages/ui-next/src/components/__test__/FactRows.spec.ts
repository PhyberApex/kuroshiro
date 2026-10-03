import type { Fact } from '../fact'
import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { expectAccessible } from '@/testing/a11y'
import { withCoarsePointer } from '@/testing/media'
import { mount, mountPage } from '@/testing/mount'
import { expectNoHorizontalOverflow } from '@/testing/overflow'
import { elementsInSealColour } from '@/testing/sealColour'
import { forceTheme, THEMES } from '@/testing/theme'
import FactRowsGallery from '../FactRows.gallery.vue'
import FactRows from '../FactRows.vue'

const FACTS: Fact[] = [
  { label: 'Last seen', value: '4 min ago' },
  { label: 'Battery', value: '18 %', alert: 'Alert: battery low' },
  { label: 'Signal', value: '−61 dBm' },
  { label: 'Special Function', value: 'Reboot at the next poll', pending: true },
]

const rowsOf = (container: Element) => [...container.querySelectorAll('dl > div')]
const saidBy = (container: Element) => rowsOf(container).map(row => [row.querySelector('dt')!.textContent!.trim(), row.querySelector('dd')!.textContent!.trim()])

describe('fact rows', () => {
  it('is a description list of label and value, in the order given, with the value in mono', async () => {
    const screen = await mount(FactRows, { props: { facts: FACTS } })

    expect(saidBy(screen.container)).toEqual([
      ['Last seen', '4 min ago'],
      ['Alert: battery low', '18 %'],
      ['Signal', '−61 dBm'],
      ['Special Function', 'Reboot at the next poll'],
    ])
    await expect.element(screen.getByRole('term').first()).toHaveTextContent('Last seen')
    expect(getComputedStyle(screen.getByRole('definition').first().element()).fontFamily).toContain('JetBrains Mono')
  })

  it.for([null, undefined, '', '  '])('leaves out a fact with no value (%j)', async (value) => {
    const screen = await mount(FactRows, { props: { facts: [{ label: 'Last seen', value: '4 min ago' }, { label: 'Battery', value }] } })

    expect(saidBy(screen.container)).toEqual([['Last seen', '4 min ago']])
  })

  it('is not there at all when no fact has a value', async () => {
    const screen = await mount(FactRows, { props: { facts: [{ label: 'Battery', value: null }] } })

    expect(screen.container.querySelector('dl')).toBeNull()
  })

  it.for(THEMES)('draws a firing Alert\'s row, and nothing else, in the seal colour with the red square, in %s', async (theme) => {
    const screen = await mount(FactRows, { props: { facts: FACTS } })
    await forceTheme(theme)
    const [, alertRow] = rowsOf(screen.container)

    const red = elementsInSealColour(screen.container)

    expect(red).toEqual(expect.arrayContaining([alertRow.querySelector('dt'), alertRow.querySelector('dd')]))
    expect(red.every(element => alertRow.contains(element))).toBe(true)
    const square = alertRow.querySelector('dt > span')!
    expect(square).toHaveAttribute('aria-hidden', 'true')
    expect(square.getBoundingClientRect()).toMatchObject({ width: 8, height: 8 })
    expect(red).toContain(square)
    expect(screen.container.querySelectorAll('dt > span')).toHaveLength(1)
  })

  it('shows the loading mark beside a pending fact, for the eye only', async () => {
    const screen = await mount(FactRows, { props: { facts: FACTS } })
    const marks = screen.container.querySelectorAll('.loading-mark')

    expect(marks).toHaveLength(1)
    expect(marks[0].closest('div')).toBe(rowsOf(screen.container)[3])
    expect(marks[0]).toHaveAttribute('aria-hidden', 'true')
  })

  it('links a value to where the fact is settled', async () => {
    const Page = defineComponent(() => () => h(FactRows, {
      facts: [{ label: 'Device Model', value: 'reports another size', to: '/devices/kitchen/settings' }],
    }))
    const screen = await mountPage({
      routes: ['/devices/kitchen', '/devices/kitchen/settings'].map(path => ({ path, component: Page })),
      at: '/devices/kitchen',
    })
    const link = screen.getByRole('link', { name: 'reports another size' })

    await withCoarsePointer(async () => {
      expect(link.element().getBoundingClientRect().height).toBe(44)
    })
    await link.click()

    await expect.poll(() => screen.router.currentRoute.value.path).toBe('/devices/kitchen/settings')
  })

  it('is accessible and does not overflow in every state', async () => {
    await mount(FactRowsGallery)

    await expectAccessible()
    await expectNoHorizontalOverflow()
  })
})
