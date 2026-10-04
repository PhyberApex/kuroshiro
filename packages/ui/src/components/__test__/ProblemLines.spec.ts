import type { ProblemLine } from '../problemLine'
import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { expectAccessible } from '@/testing/a11y'
import { withCoarsePointer } from '@/testing/media'
import { mount, mountPage } from '@/testing/mount'
import { expectNoHorizontalOverflow } from '@/testing/overflow'
import { elementsInSealColour } from '@/testing/sealColour'
import { forceTheme, THEMES } from '@/testing/theme'
import ProblemLinesGallery from '../ProblemLines.gallery.vue'
import ProblemLines from '../ProblemLines.vue'

const ALERT = 'Alert: the Data Source forecast keeps failing'
const EMPTY_FIELD = 'The required Plugin Field City is empty. Weather renders without it.'

const LINES: ProblemLine[] = [
  { kind: 'alert', text: ALERT, link: { label: 'See the error', to: '/plugins/weather/data-sources' } },
  { kind: 'problem', text: EMPTY_FIELD, link: { label: 'Fill in the Field Values', to: '/plugins/weather/field-values' } },
  { kind: 'problem', text: 'The template could not be rendered at 14:05: undefined filter "celsius"' },
]

function mountLines(lines = LINES) {
  const Page = defineComponent(() => () => h(ProblemLines, { lines }))
  return mountPage({
    routes: ['/plugins/weather', '/plugins/weather/data-sources', '/plugins/weather/field-values'].map(path => ({ path, component: Page })),
    at: '/plugins/weather',
  })
}

describe('problem lines', () => {
  it('is a list with one item per line', async () => {
    const screen = await mountLines()

    expect(screen.getByRole('list').getByRole('listitem').elements().map(item => item.querySelector('span')?.textContent?.trim()))
      .toEqual(LINES.map(line => line.text))
  })

  it('is not there at all without a line', async () => {
    const screen = await mountLines([])

    await expect.element(screen.getByRole('list')).not.toBeInTheDocument()
  })

  it('links a line to where it is fixed', async () => {
    const screen = await mountLines()

    await screen.getByRole('link', { name: 'Fill in the Field Values' }).click()

    await expect.poll(() => screen.router.currentRoute.value.path).toBe('/plugins/weather/field-values')
    expect(screen.getByRole('link').elements()).toHaveLength(2)
  })

  it.for(THEMES)('draws nothing but the Alert line in the seal colour, in %s', async (theme) => {
    const screen = await mountLines()
    await forceTheme(theme)

    const red = elementsInSealColour(screen.container)
    const alertLine = screen.getByRole('listitem').filter({ hasText: ALERT }).element()

    expect(red.length).toBeGreaterThan(0)
    expect(red.every(element => alertLine.contains(element))).toBe(true)
    expect(red.some(element => element.textContent?.includes(ALERT))).toBe(true)
    expect(red).not.toContain(screen.getByRole('link', { name: 'See the error' }).element())
  })

  it('marks an Alert line with the square and a problem line with the problem icon, both for the eye only', async () => {
    const screen = await mountLines()
    const items = screen.getByRole('listitem').elements()

    expect(items[0].querySelector('.square')).toHaveAttribute('aria-hidden', 'true')
    expect(items[0].querySelector('svg')).toBeNull()
    expect(items[1].querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    expect(items[1].querySelector('.square')).toBeNull()
  })

  it('gives a link a 44 px target at a coarse pointer', async () => {
    const screen = await mountLines()
    const link = screen.getByRole('link', { name: 'See the error' }).element()

    await withCoarsePointer(async () => {
      expect(link.getBoundingClientRect().height).toBe(44)
    })
  })

  it('is accessible and does not overflow in every state', async () => {
    await mount(ProblemLinesGallery)

    await expectAccessible()
    await expectNoHorizontalOverflow()
  })
})
