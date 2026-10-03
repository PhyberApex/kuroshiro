import { describe, expect, it, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import { expectAccessible } from '@/testing/a11y'
import { mount } from '@/testing/mount'
import { expectNoHorizontalOverflow } from '@/testing/overflow'
import { elementsInSealColour } from '@/testing/sealColour'
import NoticeGallery from '../Notice.gallery.vue'
import Notice from '../Notice.vue'

const FAILED = { title: 'Kitchen\'s Logs could not be loaded.', reason: 'The Instance did not answer.', action: 'Try again' }

describe('notice', () => {
  it('is an alert that says what could not be done and why', async () => {
    const screen = await mount(Notice, { props: FAILED })

    await expect.element(screen.getByRole('alert')).toHaveTextContent('Kitchen\'s Logs could not be loaded. The Instance did not answer.')
  })

  it('is announced once: one alert, no second live region, and the same one after it is drawn again', async () => {
    const screen = await mount(Notice, { props: FAILED })
    const alert = screen.getByRole('alert').element()

    await screen.rerender({ ...FAILED })

    expect(screen.container.querySelectorAll('[role="alert"], [role="status"], [aria-live]')).toHaveLength(1)
    expect(screen.getByRole('alert').element()).toBe(alert)
  })

  it('keeps its button out of what is announced', async () => {
    const screen = await mount(Notice, { props: FAILED })

    await expect.element(screen.getByRole('alert')).not.toHaveTextContent('Try again')
  })

  it('fires its action on a click and from the keyboard', async () => {
    const onAct = vi.fn()
    const screen = await mount(Notice, { props: { ...FAILED, onAct } })

    await userEvent.keyboard('{Tab}{Enter}')
    await screen.getByRole('button', { name: 'Try again' }).click()

    expect(onAct).toHaveBeenCalledTimes(2)
  })

  it('has no button without an action, and no reason without one', async () => {
    const screen = await mount(Notice, { props: { title: 'Could not load Kitchen\'s Settings.' } })

    await expect.poll(() => screen.getByRole('alert').element().textContent?.trim()).toBe('Could not load Kitchen\'s Settings.')
    await expect.element(screen.getByRole('button')).not.toBeInTheDocument()
  })

  it('is ink under a 2 px ink rule, with nothing in the seal colour', async () => {
    const screen = await mount(NoticeGallery)
    const notice = screen.getByRole('alert').first().element().parentElement!

    await expect.poll(() => getComputedStyle(notice).borderTopWidth).toBe('2px')
    expect(getComputedStyle(notice).borderTopColor).toBe(getComputedStyle(document.body).color)
    expect(elementsInSealColour(screen.container)).toEqual([])
  })

  it('is accessible and does not overflow in every state', async () => {
    await mount(NoticeGallery)

    await expectAccessible()
    await expectNoHorizontalOverflow()
  })
})
