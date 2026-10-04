import { describe, expect, it } from 'vitest'
import { expectAccessible } from '@/testing/a11y'
import { mount } from '@/testing/mount'
import { expectNoHorizontalOverflow } from '@/testing/overflow'
import { elementsInSealColour } from '@/testing/sealColour'
import { resetViewport, resizeTo } from '@/testing/viewport'
import SummaryListGallery from '../SummaryList.gallery.vue'

const left = (element: Element) => element.getBoundingClientRect().left
const top = (element: Element) => element.getBoundingClientRect().top

describe('summary list', () => {
  it('is a description list: each row a label and its value, the label in soft ink', async () => {
    const screen = await mount(SummaryListGallery)
    const list = screen.container.querySelector('dl')!

    expect([...list.querySelectorAll('dt')].map(label => label.textContent?.trim())).toEqual(['Archive', 'Adds', 'Replaces', 'Mind'])
    expect([...list.children].every(row => row.matches('div') && row.querySelector(':scope > dt + dd') !== null)).toBe(true)
    await expect.element(screen.getByRole('term').first()).toHaveTextContent('Archive')
    await expect.element(screen.getByRole('definition').nth(1)).toHaveTextContent('1 Device (Hallway), 4 Plugins, 9 Screens with their Schedules, 1 Mashup, 1 custom Palette, 1 custom Firmware')
    const probe = screen.container.appendChild(document.createElement('span'))
    probe.style.color = 'var(--color-ink-soft)'
    await expect.poll(() => getComputedStyle(list.querySelector('dt')!).color).toBe(getComputedStyle(probe).color)
  })

  it('lists a row\'s problems one line each, with the problem icon and in ink', async () => {
    const screen = await mount(SummaryListGallery)
    const lines = screen.getByRole('definition').last().getByRole('listitem')

    expect(lines.elements().map(line => line.textContent?.trim())).toEqual([
      'Hallway\'s API key was redacted. Hallway gets a new one and has to be set up again.',
      'Firmware 2.0.3 comes without its file. Upload it again before pushing it.',
    ])
    expect(lines.elements().every(line => line.querySelector('svg')?.getAttribute('aria-hidden') === 'true')).toBe(true)
    expect(elementsInSealColour(screen.container)).toEqual([])
  })

  it('stands on rules: a heavy one above the list and one under every row', async () => {
    const screen = await mount(SummaryListGallery)
    const list = screen.container.querySelector('dl')!

    await expect.poll(() => getComputedStyle(list).borderTopWidth).toBe('2px')
    expect([...list.children].map(row => getComputedStyle(row).borderBottomWidth)).toEqual(['1px', '1px', '1px', '1px'])
  })

  it('puts the value beside its label, and under it on a phone', async () => {
    const screen = await mount(SummaryListGallery)
    const label = screen.getByRole('term').first().element()
    const value = screen.getByRole('definition').first().element()

    expect(left(value)).toBeGreaterThan(left(label))
    expect(top(value)).toBe(top(label))

    await resizeTo(375)
    try {
      await expect.poll(() => top(value)).toBeGreaterThan(top(label))
      expect(left(value)).toBe(left(label))
    }
    finally {
      await resetViewport()
    }
  })

  it('is accessible and does not overflow', async () => {
    await mount(SummaryListGallery)

    await expectAccessible()
    await expectNoHorizontalOverflow()
  })
})
