import { describe, expect, it } from 'vitest'
import { expectAccessible } from '@/testing/a11y'
import { mount } from '@/testing/mount'
import { expectNoHorizontalOverflow } from '@/testing/overflow'
import { elementsInSealColour } from '@/testing/sealColour'
import { resetViewport, resizeTo } from '@/testing/viewport'
import LibraryRowGallery from '../LibraryRow.gallery.vue'
import LibraryRow from '../LibraryRow.vue'

const MISSING_FILE = 'Its file is missing, so it cannot be pushed. Delete it and upload it again.'

const cellsOf = (row: Element) => [...row.querySelector('.cells')!.children].map(cell => cell.textContent?.replace(/\s+/g, ' ').trim())

describe('library row', () => {
  it('is a list item of three cells: the name, what it is, and the date with its actions', async () => {
    const screen = await mount(LibraryRow, {
      props: { name: '1.7.9' },
      slots: { default: 'Official · Fits every Device Model', end: 'Synced 3 h ago' },
    })
    const row = screen.getByRole('listitem').element()

    expect(cellsOf(row)).toEqual(['1.7.9', 'Official · Fits every Device Model', 'Synced 3 h ago'])
  })

  it('sets a name that is a value in mono, and one that is words in the text face', async () => {
    const screen = await mount(LibraryRow, { props: { name: '1.7.9', mono: true } })
    const name = screen.getByText('1.7.9')
    await expect.poll(() => getComputedStyle(name.element()).fontFamily).toContain('JetBrains Mono')

    await screen.rerender({ name: 'Soft red', mono: false })

    await expect.poll(() => getComputedStyle(screen.getByText('Soft red').element()).fontFamily).not.toContain('JetBrains Mono')
  })

  it('says its problem under what it is, with the problem icon and in ink', async () => {
    const screen = await mount(LibraryRow, {
      props: { name: '2.0.3', problem: MISSING_FILE },
      slots: { default: 'Custom · TRMNL X build' },
    })
    const row = screen.getByRole('listitem').element()

    await expect.element(screen.getByText(MISSING_FILE)).toBeVisible()
    expect(row.querySelector('.what .problem')?.textContent?.trim()).toBe(MISSING_FILE)
    expect(row.querySelector('.problem svg')?.getAttribute('aria-hidden')).toBe('true')
    expect(elementsInSealColour(screen.container)).toEqual([])
  })

  it('holds a form that is open under it, below its cells and inside the same list item', async () => {
    const screen = await mount(LibraryRow, {
      props: { name: 'Soft red' },
      slots: { form: '<form aria-label="Edit Soft red"></form>' },
    })
    const row = screen.getByRole('listitem').element()

    expect(row.querySelector('.cells + .open-form form')).toBe(screen.getByRole('form', { name: 'Edit Soft red' }).element())
  })

  it('stacks on a phone: the name with the date and actions on one line, what it is below', async () => {
    const screen = await mount(LibraryRow, {
      props: { name: '1.7.9' },
      slots: { default: 'Official · Fits every Device Model', end: 'Synced 3 h ago' },
    })
    const top = (text: string) => screen.getByText(text).element().getBoundingClientRect().top

    await resizeTo(375)
    try {
      expect(Math.abs(top('1.7.9') - top('Synced 3 h ago'))).toBeLessThan(8)
      expect(top('Official · Fits every Device Model')).toBeGreaterThan(top('1.7.9') + 8)
    }
    finally {
      await resetViewport()
    }
  })

  it('is accessible and does not overflow in every state', async () => {
    await mount(LibraryRowGallery)

    await expectAccessible()
    await expectNoHorizontalOverflow()
  })
})
