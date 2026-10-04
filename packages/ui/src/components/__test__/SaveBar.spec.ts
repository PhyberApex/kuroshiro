import { describe, expect, it, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import { defineComponent, h } from 'vue'
import { expectAccessible } from '@/testing/a11y'
import { mount } from '@/testing/mount'
import { expectNoHorizontalOverflow } from '@/testing/overflow'
import { settled } from '@/testing/paint'
import { elementsInSealColour } from '@/testing/sealColour'
import { resetViewport, resizeTo } from '@/testing/viewport'
import SaveBarGallery from '../SaveBar.gallery.vue'
import SaveBar from '../SaveBar.vue'

const LABELS = { saveLabel: 'Save Plugin', cancelLabel: 'Discard changes' }

/** A page taller than the window, with the bar as the last thing in it. */
function pageWith(props: object) {
  return defineComponent(() => () => h('div', { 'data-testid': 'page' }, [
    ...Array.from({ length: 60 }, (_, index) => h('p', { style: 'min-height: 2rem' }, `Row ${index + 1}`)),
    h(SaveBar, { changed: true, ...LABELS, ...props }),
  ]))
}

describe('save bar', () => {
  it('is hidden while nothing has changed, with its status region already there and silent', async () => {
    const screen = await mount(SaveBar, { props: { changed: false, ...LABELS } })

    await expect.element(screen.getByRole('region', { name: 'Unsaved changes' })).not.toBeInTheDocument()
    await expect.element(screen.getByRole('button')).not.toBeInTheDocument()
    await expect.element(screen.getByRole('status')).toBeEmptyDOMElement()
  })

  it('appears as a section named "Unsaved changes" and announces itself in the region that was there before', async () => {
    const screen = await mount(SaveBar, { props: { changed: false, ...LABELS } })
    const region = screen.getByRole('status').element()

    await screen.rerender({ changed: true })

    const bar = screen.getByRole('region', { name: 'Unsaved changes' })
    await expect.element(bar).toBeVisible()
    expect(bar.element().localName).toBe('section')
    await expect.element(screen.getByRole('status')).toHaveTextContent('Unsaved changes')
    expect(screen.getByRole('status').element()).toBe(region)
  })

  it('says what has changed after "Unsaved changes"', async () => {
    const screen = await mount(SaveBar, { props: { changed: true, ...LABELS }, slots: { default: () => 'to the template. The preview already shows them.' } })

    await expect.element(screen.getByRole('region', { name: 'Unsaved changes' }).getByText('Unsaved changes to the template. The preview already shows them.'))
      .toBeVisible()
  })

  it('holds the page\'s primary button and the one that cancels, reached in that order by Tab', async () => {
    const onSave = vi.fn()
    const onCancel = vi.fn()
    const screen = await mount(SaveBar, { props: { changed: true, ...LABELS, onSave, onCancel } })

    await userEvent.keyboard('{Tab}')
    await expect.element(screen.getByRole('button', { name: 'Discard changes' })).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    await userEvent.keyboard('{Tab}')
    await expect.element(screen.getByRole('button', { name: 'Save Plugin' })).toHaveFocus()
    await userEvent.keyboard('{Enter}')

    expect(onCancel).toHaveBeenCalledOnce()
    expect(onSave).toHaveBeenCalledOnce()
  })

  it('names the cancelling button "Cancel" unless the page names it', async () => {
    const screen = await mount(SaveBar, { props: { changed: true, saveLabel: 'Save HTML' } })

    await expect.element(screen.getByRole('button', { name: 'Cancel' })).toBeVisible()
  })

  it('shows the loading mark on the primary button while saving, and neither button fires', async () => {
    const onSave = vi.fn()
    const onCancel = vi.fn()
    const screen = await mount(SaveBar, { props: { changed: true, saving: true, ...LABELS, onSave, onCancel } })
    const save = screen.getByRole('button', { name: 'Save Plugin' })

    await expect.element(save).toHaveAttribute('aria-busy', 'true')
    await save.click({ force: true })
    await screen.getByRole('button', { name: 'Discard changes' }).click({ force: true })

    expect(onSave).not.toHaveBeenCalled()
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('says what stops the save when a value is invalid, announces it and offers "Show the first"', async () => {
    const onShowFirst = vi.fn()
    const screen = await mount(SaveBar, { props: { changed: true, invalid: '2 things to fix before this can be saved.', ...LABELS, onShowFirst } })

    await expect.element(screen.getByRole('region', { name: 'Unsaved changes' }).getByText('2 things to fix before this can be saved.')).toBeVisible()
    await expect.element(screen.getByRole('status')).toHaveTextContent('2 things to fix before this can be saved.')

    await screen.getByRole('button', { name: 'Show the first' }).click()

    expect(onShowFirst).toHaveBeenCalledOnce()
  })

  it('says "Not saved" with the reason, announces it, and saves again on "Try again"', async () => {
    const onSave = vi.fn()
    const screen = await mount(SaveBar, { props: { changed: true, failed: true, reason: 'Kuroshiro\'s server is not answering.', ...LABELS, onSave } })

    await expect.element(screen.getByRole('region', { name: 'Unsaved changes' }).getByText('Not saved. Kuroshiro\'s server is not answering.')).toBeVisible()
    await expect.element(screen.getByRole('status')).toHaveTextContent('Not saved. Kuroshiro\'s server is not answering.')

    await screen.getByRole('button', { name: 'Try again' }).click()

    expect(onSave).toHaveBeenCalledOnce()
  })

  it('sticks to the bottom of the window on paper under a 2 px ink rule, with no shadow', async () => {
    const screen = await mount(pageWith({}))
    const bar = screen.getByRole('region', { name: 'Unsaved changes' }).element()

    await expect.poll(() => Math.round(bar.getBoundingClientRect().bottom)).toBe(window.innerHeight)
    expect(getComputedStyle(bar).borderTopWidth).toBe('2px')
    expect(getComputedStyle(bar).backgroundColor).toBe(getComputedStyle(document.body).backgroundColor)
    expect(getComputedStyle(bar).boxShadow).toBe('none')
  })

  it('does not cover the last content of the page once the page is scrolled to its end', async () => {
    const screen = await mount(pageWith({}))
    const bar = screen.getByRole('region', { name: 'Unsaved changes' }).element()
    const lastRow = screen.getByText('Row 60', { exact: true }).element()

    window.scrollTo(0, document.documentElement.scrollHeight)
    await settled()

    expect(lastRow.getBoundingClientRect().bottom).toBeLessThanOrEqual(bar.getBoundingClientRect().top)
    window.scrollTo(0, 0)
  })

  it('stands above the bottom tabs on a phone', async () => {
    const screen = await mount(pageWith({}))
    const bar = screen.getByRole('region', { name: 'Unsaved changes' }).element()

    await resizeTo(375, 812)
    try {
      const tabsHeight = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--bar-height')) * 16
      await expect.poll(() => Math.round(window.innerHeight - bar.getBoundingClientRect().bottom)).toBe(tabsHeight)
    }
    finally {
      await resetViewport()
    }
  })

  it('has nothing in the seal colour when the save failed', async () => {
    const screen = await mount(SaveBarGallery)

    expect(elementsInSealColour(screen.container)).toEqual([])
  })

  it('is accessible and does not overflow in every state', async () => {
    await mount(SaveBarGallery)

    await expectAccessible()
    await expectNoHorizontalOverflow()
  })
})
