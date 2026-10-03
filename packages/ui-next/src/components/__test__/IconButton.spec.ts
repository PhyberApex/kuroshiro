import { describe, expect, it, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import { expectAccessible } from '@/testing/a11y'
import { withCoarsePointer } from '@/testing/media'
import { mount } from '@/testing/mount'
import { expectNoHorizontalOverflow } from '@/testing/overflow'
import IconButtonGallery from '../IconButton.gallery.vue'
import IconButton from '../IconButton.vue'

describe('icon button', () => {
  it('is a button named by its label, with a decorative icon', async () => {
    const screen = await mount(IconButton, { props: { icon: 'up', label: 'Move Weather earlier' } })

    const button = screen.getByRole('button', { name: 'Move Weather earlier' })
    await expect.element(button).toBeVisible()
    expect(button.element().querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })

  it.for([undefined, '', '  '])('cannot be mounted without a name (%o)', async (label) => {
    const silenced = vi.spyOn(console, 'warn').mockImplementation(() => {})

    await expect(mount(IconButton, { props: { icon: 'up', label: label as string } }))
      .rejects
      .toThrow('An IconButton needs a label')

    silenced.mockRestore()
  })

  it('fires on a click, on Enter and on Space', async () => {
    const onClick = vi.fn()
    const screen = await mount(IconButton, { props: { icon: 'up', label: 'Move Weather earlier' }, attrs: { onClick } })

    await screen.getByRole('button', { name: 'Move Weather earlier' }).click()
    await userEvent.keyboard('{Enter}')
    await userEvent.keyboard(' ')

    expect(onClick).toHaveBeenCalledTimes(3)
  })

  it('does not fire while disabled', async () => {
    const onClick = vi.fn()
    const screen = await mount(IconButton, { props: { icon: 'up', label: 'Move Weather earlier', disabled: true }, attrs: { onClick } })
    const button = screen.getByRole('button', { name: 'Move Weather earlier' })

    await expect.element(button).toBeDisabled()
    await button.click({ force: true })

    expect(onClick).not.toHaveBeenCalled()
  })

  it('shows its name as a tooltip on hover', async () => {
    const screen = await mount(IconButton, { props: { icon: 'more', label: 'More actions for Weather' } })
    await expect.element(screen.getByRole('tooltip', { includeHidden: true })).not.toBeInTheDocument()

    await screen.getByRole('button', { name: 'More actions for Weather' }).hover()

    await expect.element(screen.getByRole('tooltip', { includeHidden: true })).toHaveTextContent('More actions for Weather')
  })

  it('shows its tooltip on keyboard focus and closes it on Escape', async () => {
    const screen = await mount(IconButton, { props: { icon: 'more', label: 'More actions for Weather' } })

    await userEvent.keyboard('{Tab}')
    await expect.element(screen.getByRole('tooltip', { includeHidden: true })).toHaveTextContent('More actions for Weather')

    await userEvent.keyboard('{Escape}')

    await expect.element(screen.getByRole('tooltip', { includeHidden: true })).not.toBeInTheDocument()
  })

  it('is a 32 px square, and 44 px at a coarse pointer', async () => {
    const screen = await mount(IconButton, { props: { icon: 'up', label: 'Move Weather earlier' } })
    const button = screen.getByRole('button', { name: 'Move Weather earlier' }).element()
    const size = () => [button.getBoundingClientRect().width, button.getBoundingClientRect().height]

    expect(size()).toEqual([32, 32])
    await withCoarsePointer(async () => {
      expect(size()).toEqual([44, 44])
    })
  })

  it('is accessible and does not overflow in every state', async () => {
    await mount(IconButtonGallery)

    await expectAccessible()
    await expectNoHorizontalOverflow()
  })
})
