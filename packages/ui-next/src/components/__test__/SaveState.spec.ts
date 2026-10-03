import { describe, expect, it, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import { expectAccessible } from '@/testing/a11y'
import { mount } from '@/testing/mount'
import { expectNoHorizontalOverflow } from '@/testing/overflow'
import { elementsInSealColour } from '@/testing/sealColour'
import SaveStateGallery from '../SaveState.gallery.vue'
import SaveState from '../SaveState.vue'

describe('save state', () => {
  it('is a status region that says nothing while nothing is being saved', async () => {
    const screen = await mount(SaveState, { props: { status: 'idle' } })

    await expect.element(screen.getByRole('status')).toBeInTheDocument()
    await expect.element(screen.getByRole('status')).toBeEmptyDOMElement()
  })

  it('says "Saving", then "Saved", in the region that was already there', async () => {
    const screen = await mount(SaveState, { props: { status: 'idle' } })
    const region = screen.getByRole('status').element()

    await screen.rerender({ status: 'saving' })
    await expect.element(screen.getByRole('status')).toHaveTextContent('Saving')

    await screen.rerender({ status: 'saved' })
    await expect.element(screen.getByRole('status')).toHaveTextContent('Saved')
    expect(screen.getByRole('status').element()).toBe(region)
  })

  it('says "Not saved" with the reason, and offers "Try again"', async () => {
    const onRetry = vi.fn()
    const screen = await mount(SaveState, { props: { status: 'failed', reason: 'A Device with this name already exists.', onRetry } })

    await expect.element(screen.getByRole('status')).toHaveTextContent('Not saved. A Device with this name already exists.')

    await userEvent.keyboard('{Tab}{Enter}')
    await screen.getByRole('button', { name: 'Try again' }).click()

    expect(onRetry).toHaveBeenCalledTimes(2)
  })

  it('says "Not saved." alone when the failure gave no reason', async () => {
    const screen = await mount(SaveState, { props: { status: 'failed' } })

    await expect.poll(() => screen.getByRole('status').element().textContent?.trim()).toBe('Not saved.')
  })

  it('offers "Try again" only after a failed save', async () => {
    const screen = await mount(SaveState, { props: { status: 'saved' } })

    await expect.element(screen.getByRole('button')).not.toBeInTheDocument()
  })

  it('is ink, not the seal colour, when the save failed', async () => {
    const screen = await mount(SaveState, { props: { status: 'failed' } })

    await expect.poll(() => getComputedStyle(screen.getByRole('status').element()).color).toBe(getComputedStyle(document.body).color)
    expect(elementsInSealColour(screen.container)).toEqual([])
  })

  it('saves a control\'s commit and shows what came of it', async () => {
    const screen = await mount(SaveStateGallery)
    const name = screen.getByRole('textbox', { name: 'Name of the Device' })
    const state = () => screen.getByRole('status').last()

    await name.fill('  Hallway ')
    await userEvent.keyboard('{Enter}')
    await expect.element(state()).toHaveTextContent('Saving')
    await expect.element(state()).toHaveTextContent('Saved')
    await expect.element(name).toHaveValue('Hallway')
    await expect.element(state(), { timeout: 4000 }).toBeEmptyDOMElement()

    await name.fill(' ')
    await userEvent.keyboard('{Enter}')
    await expect.element(state()).toHaveTextContent('Not saved. A Device needs a name.')
    await expect.element(name).toHaveValue(' ')
  })

  it('is accessible and does not overflow in every state', async () => {
    await mount(SaveStateGallery)

    await expectAccessible()
    await expectNoHorizontalOverflow()
  })
})
