import { describe, expect, it, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import { expectAccessible } from '@/testing/a11y'
import { withCoarsePointer } from '@/testing/media'
import { mount } from '@/testing/mount'
import { expectNoHorizontalOverflow } from '@/testing/overflow'
import LineShownOnceGallery from '../LineShownOnce.gallery.vue'
import LineShownOnce from '../LineShownOnce.vue'

const CREATED = 'Created. It shows its name until you write its template.'

describe('line shown once', () => {
  it('is a status on the wash ground, with "Dismiss" outside what is announced', async () => {
    const screen = await mount(LineShownOnce, { slots: { default: CREATED } })
    const line = screen.getByRole('status')
    const wash = getComputedStyle(document.documentElement).getPropertyValue('--color-wash')

    await expect.element(line).toHaveTextContent(CREATED)
    await expect.element(line).not.toHaveTextContent('Dismiss')
    const probe = document.body.appendChild(document.createElement('span'))
    probe.style.backgroundColor = wash
    await expect.poll(() => getComputedStyle(line.element().parentElement!).backgroundColor).toBe(getComputedStyle(probe).backgroundColor)
    probe.remove()
  })

  it('is gone after "Dismiss", by a click or from the keyboard, and says so once', async () => {
    const onDismiss = vi.fn()
    const screen = await mount(LineShownOnce, { props: { onDismiss }, slots: { default: CREATED } })

    await userEvent.keyboard('{Tab}{Enter}')

    await expect.element(screen.getByRole('status')).not.toBeInTheDocument()
    await expect.element(screen.getByRole('button', { name: 'Dismiss' })).not.toBeInTheDocument()
    expect(onDismiss).toHaveBeenCalledOnce()
  })

  it('is dismissed on a click', async () => {
    const screen = await mount(LineShownOnce, { slots: { default: CREATED } })

    await screen.getByRole('button', { name: 'Dismiss' }).click()

    await expect.element(screen.getByText(CREATED)).not.toBeInTheDocument()
  })

  it('gives "Dismiss" a 44 px target at a coarse pointer', async () => {
    const screen = await mount(LineShownOnce, { slots: { default: CREATED } })
    const dismiss = screen.getByRole('button', { name: 'Dismiss' }).element()

    await withCoarsePointer(async () => {
      expect(dismiss.getBoundingClientRect().height).toBe(44)
    })
  })

  it('is accessible and does not overflow in every state', async () => {
    await mount(LineShownOnceGallery)

    await expectAccessible()
    await expectNoHorizontalOverflow()
  })
})
