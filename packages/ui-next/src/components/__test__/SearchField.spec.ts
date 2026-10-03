import { describe, expect, it, vi } from 'vitest'
import { expectAccessible } from '@/testing/a11y'
import { withCoarsePointer } from '@/testing/media'
import { mount } from '@/testing/mount'
import { expectNoHorizontalOverflow } from '@/testing/overflow'
import SearchFieldGallery from '../SearchField.gallery.vue'
import SearchField from '../SearchField.vue'

const SEARCH = { 'aria-label': 'Search messages', 'placeholder': 'Search messages' }

describe('search field', () => {
  it('is a native search input with a decorative search icon', async () => {
    const screen = await mount(SearchField, { attrs: SEARCH })
    const input = screen.getByRole('searchbox', { name: 'Search messages' })

    await expect.element(input).toHaveAttribute('type', 'search')
    await expect.element(input).toHaveAttribute('placeholder', 'Search messages')
    expect(screen.container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })

  it('reports the query as it is typed, and an empty one when it is cleared', async () => {
    const onUpdate = vi.fn()
    const screen = await mount(SearchField, { props: { 'modelValue': '', 'onUpdate:modelValue': onUpdate }, attrs: SEARCH })
    const input = screen.getByRole('searchbox', { name: 'Search messages' })

    await input.fill('battery')
    expect(onUpdate).toHaveBeenLastCalledWith('battery')

    await input.clear()
    expect(onUpdate).toHaveBeenLastCalledWith('')
  })

  it('shows the query it is given', async () => {
    const screen = await mount(SearchField, { props: { modelValue: 'battery' }, attrs: SEARCH })

    await expect.element(screen.getByRole('searchbox', { name: 'Search messages' })).toHaveValue('battery')
  })

  it('does not write its text over the icon', async () => {
    const screen = await mount(SearchField, { props: { modelValue: 'battery' }, attrs: SEARCH })
    const input = screen.getByRole('searchbox', { name: 'Search messages' }).element()
    const icon = screen.container.querySelector('svg')!.getBoundingClientRect()

    expect(input.getBoundingClientRect().left + Number.parseFloat(getComputedStyle(input).paddingLeft)).toBeGreaterThan(icon.right)
  })

  it('can be disabled', async () => {
    const screen = await mount(SearchField, { props: { disabled: true }, attrs: SEARCH })

    await expect.element(screen.getByRole('searchbox', { name: 'Search messages' })).toBeDisabled()
  })

  it('is 32 px high, and 44 px with 16 px text at a coarse pointer', async () => {
    const screen = await mount(SearchField, { attrs: SEARCH })
    const input = screen.getByRole('searchbox', { name: 'Search messages' }).element()

    expect(input.getBoundingClientRect().height).toBe(32)
    await withCoarsePointer(async () => {
      expect(input.getBoundingClientRect().height).toBe(44)
      expect(getComputedStyle(input).fontSize).toBe('16px')
    })
  })

  it('is accessible and does not overflow in every state', async () => {
    await mount(SearchFieldGallery)

    await expectAccessible()
    await expectNoHorizontalOverflow()
  })
})
