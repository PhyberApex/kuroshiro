import { describe, expect, it, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import { h } from 'vue'
import { expectAccessible } from '@/testing/a11y'
import { mount } from '@/testing/mount'
import { expectNoHorizontalOverflow } from '@/testing/overflow'
import TooltipGallery from '../Tooltip.gallery.vue'
import Tooltip from '../Tooltip.vue'

function mountAroundATime(onClick = vi.fn()) {
  return mount(Tooltip, {
    props: { text: '3 October 2026 at 14:02' },
    slots: { default: () => h('button', { type: 'button', onClick }, '4 min ago') },
  })
}

// Reka keeps the described-by text in an element that is hidden from the accessibility tree.
function tooltip(screen: Awaited<ReturnType<typeof mountAroundATime>>) {
  return screen.getByRole('tooltip', { includeHidden: true })
}

describe('tooltip', () => {
  it('opens when its element is hovered', async () => {
    const screen = await mountAroundATime()
    await expect.element(tooltip(screen)).not.toBeInTheDocument()

    await screen.getByRole('button', { name: '4 min ago' }).hover()

    await expect.element(tooltip(screen)).toHaveTextContent('3 October 2026 at 14:02')
    await expect.element(screen.getByRole('button', { name: '4 min ago' })).toHaveAccessibleDescription('3 October 2026 at 14:02')
  })

  it('opens on keyboard focus and closes on Escape', async () => {
    const screen = await mountAroundATime()

    await userEvent.keyboard('{Tab}')
    await expect.element(screen.getByRole('button', { name: '4 min ago' })).toHaveFocus()
    await expect.element(tooltip(screen)).toBeInTheDocument()

    await userEvent.keyboard('{Escape}')

    await expect.element(tooltip(screen)).not.toBeInTheDocument()
    await expect.element(screen.getByRole('button', { name: '4 min ago' })).toHaveFocus()
  })

  it('closes when the focus leaves', async () => {
    const screen = await mountAroundATime()
    await userEvent.keyboard('{Tab}')
    await expect.element(tooltip(screen)).toBeInTheDocument()

    await userEvent.keyboard('{Tab}')

    await expect.element(tooltip(screen)).not.toBeInTheDocument()
  })

  it('stays out of the way of a touch: the press goes through and nothing opens', async () => {
    const onClick = vi.fn()
    const screen = await mountAroundATime(onClick)
    const trigger = screen.getByRole('button', { name: '4 min ago' }).element() as HTMLElement
    const touch = { pointerType: 'touch', bubbles: true }

    trigger.dispatchEvent(new PointerEvent('pointermove', touch))
    trigger.dispatchEvent(new PointerEvent('pointerdown', touch))
    trigger.focus()
    trigger.dispatchEvent(new PointerEvent('pointerup', touch))
    trigger.click()

    expect(onClick).toHaveBeenCalledOnce()
    await new Promise(resolve => setTimeout(resolve, 600))
    await expect.element(tooltip(screen)).not.toBeInTheDocument()
  })

  it('is drawn solid ink with no shadow', async () => {
    const screen = await mount(Tooltip, {
      props: { text: 'Kitchen, beside the window', open: true },
      slots: { default: () => h('span', 'Kitchen, besi…') },
    })

    await expect.element(screen.getByText('Kitchen, beside the window').first()).toBeVisible()
    await expect.element(screen.getByText('Kitchen, beside the window').first()).toHaveStyle({
      backgroundColor: 'rgb(18, 18, 18)',
      color: 'rgb(255, 255, 255)',
      boxShadow: 'none',
    })
  })

  it('is accessible and does not overflow, open and closed', async () => {
    await mount(TooltipGallery)

    await expectAccessible()
    await expectNoHorizontalOverflow()
  })
})
