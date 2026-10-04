import { describe, expect, it } from 'vitest'
import { userEvent } from 'vitest/browser'
import { expectAccessible } from '@/testing/a11y'
import { mount } from '@/testing/mount'
import { expectNoHorizontalOverflow } from '@/testing/overflow'
import { elementsInSealColour } from '@/testing/sealColour'
import DiffGallery from '../Diff.gallery.vue'
import Diff from '../Diff.vue'

const BEFORE = ['<div class="item">', '  <span>{{ temp }}°</span>', '</div>']
const AFTER = ['<div class="item">', '  <span>{{ temp }}{{ unit }}</span>', '</div>']
const LONG = Array.from({ length: 12 }, (_, index) => `line ${index + 1}`)

const itemsOf = (container: Element) => [...container.querySelectorAll('ol > li')] as HTMLElement[]

/** What a screen reader reads for each line: the hidden word in front, the line itself, never the sign. */
function spoken(item: HTMLElement) {
  return [...item.childNodes]
    .filter(node => node.nodeType !== Node.COMMENT_NODE && !(node instanceof HTMLElement && node.getAttribute('aria-hidden') === 'true'))
    .map(node => node.textContent)
    .join('')
}

function colourOf(token: string) {
  const probe = document.body.appendChild(document.createElement('span'))
  probe.style.color = `var(${token})`
  const colour = getComputedStyle(probe).color
  probe.remove()
  return colour
}

describe('diff', () => {
  it('is an ordered list named for what it compares, with each changed line named for a screen reader', async () => {
    const screen = await mount(Diff, { props: { before: BEFORE, after: AFTER, label: 'The Recipe\'s change to Template full' } })

    await expect.element(screen.getByRole('list', { name: 'The Recipe\'s change to Template full' })).toBeVisible()
    expect(itemsOf(screen.container).map(spoken)).toEqual([
      '<div class="item">',
      'removed:   <span>{{ temp }}°</span>',
      'added:   <span>{{ temp }}{{ unit }}</span>',
      '</div>',
    ])
  })

  it('tells a removed line by its sign and its strike, and an added one by its sign, weight and wash, never by colour', async () => {
    const screen = await mount(Diff, { props: { before: BEFORE, after: AFTER, label: 'Change' } })
    const [, removed, added] = itemsOf(screen.container)

    expect(removed!.querySelector('[aria-hidden="true"]')!.textContent).toBe('−')
    expect(getComputedStyle(removed!.querySelector('.text')!).textDecorationLine).toBe('line-through')
    expect(getComputedStyle(removed!).color).toBe(colourOf('--color-ink-soft'))
    expect(added!.querySelector('[aria-hidden="true"]')!.textContent).toBe('+')
    expect(getComputedStyle(added!).fontWeight).toBe('600')
    expect(getComputedStyle(added!).backgroundColor).toBe('rgb(241, 241, 241)')
    expect(elementsInSealColour(screen.container)).toEqual([])
  })

  it('is the same diff for a one-line value', async () => {
    const screen = await mount(Diff, { props: { before: ['every 15 minutes'], after: ['every 30 minutes'], label: 'Change' } })

    expect(itemsOf(screen.container).map(spoken)).toEqual(['removed: every 15 minutes', 'added: every 30 minutes'])
  })

  it('folds a long run of unchanged lines, and opens it by keyboard', async () => {
    const screen = await mount(Diff, { props: { before: LONG, after: [...LONG.slice(0, 11), 'line twelve'], label: 'Change' } })

    expect(itemsOf(screen.container)).toHaveLength(5)
    await userEvent.keyboard('{Tab}{Tab}')
    await expect.element(screen.getByRole('button', { name: '… 9 lines the same' })).toHaveFocus()
    await userEvent.keyboard('{Enter}')

    expect(itemsOf(screen.container).map(spoken)).toEqual([...LONG.slice(0, 11), 'removed: line 12', 'added: line twelve'])
    expect(screen.getByRole('button').elements()).toEqual([])
    await expect.element(screen.getByRole('list')).toHaveFocus()
  })

  it('shows every line of a value it is not asked to fold', async () => {
    const screen = await mount(Diff, { props: { before: LONG, after: LONG, label: 'Yours', fold: false } })

    expect(itemsOf(screen.container).map(spoken)).toEqual(LONG)
  })

  it('scrolls a long line sideways inside itself, where the keyboard can reach it', async () => {
    const screen = await mount(Diff, { props: { before: [], after: ['x'.repeat(2000)], label: 'Change' } })
    const list = screen.getByRole('list').element() as HTMLElement

    expect(list.scrollWidth).toBeGreaterThan(list.clientWidth)
    expect(document.documentElement.scrollWidth).toBe(document.documentElement.clientWidth)
    await userEvent.keyboard('{Tab}')
    expect(document.activeElement).toBe(list)
  })

  it('is accessible and does not overflow in every state', async () => {
    await mount(DiffGallery)

    await expectAccessible()
    await expectNoHorizontalOverflow()
  })
})
