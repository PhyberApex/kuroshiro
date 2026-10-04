import { describe, expect, it, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import { defineComponent, h } from 'vue'
import { RouterLink } from 'vue-router'
import { expectAccessible } from '@/testing/a11y'
import { withCoarsePointer, withMotionAllowed } from '@/testing/media'
import { mount, mountPage } from '@/testing/mount'
import { expectNoHorizontalOverflow } from '@/testing/overflow'
import { forceTheme, THEMES } from '@/testing/theme'
import ButtonGallery from '../Button.gallery.vue'
import Button from '../Button.vue'

function isGrey(colour: string) {
  const [red, green, blue] = colour.match(/[\d.]+/g)!.map(Number)
  return red === green && green === blue
}

describe('button', () => {
  it('fires on a click, on Enter and on Space', async () => {
    const onClick = vi.fn()
    const screen = await mount(Button, { props: { onClick }, slots: { default: 'Update now' } })

    await screen.getByRole('button', { name: 'Update now' }).click()
    await userEvent.keyboard('{Enter}')
    await userEvent.keyboard(' ')

    expect(onClick).toHaveBeenCalledTimes(3)
  })

  it('is reached with Tab', async () => {
    const screen = await mount(Button, { slots: { default: 'Update now' } })

    await userEvent.keyboard('{Tab}')

    await expect.element(screen.getByRole('button', { name: 'Update now' })).toHaveFocus()
  })

  it('does not submit a form unless it is asked to', async () => {
    const screen = await mount(Button, { slots: { default: 'Update now' } })

    await expect.element(screen.getByRole('button', { name: 'Update now' })).toHaveAttribute('type', 'button')
  })

  it('does not fire while disabled', async () => {
    const onClick = vi.fn()
    const screen = await mount(Button, { props: { disabled: true, onClick }, slots: { default: 'Update now' } })
    const button = screen.getByRole('button', { name: 'Update now' })

    await expect.element(button).toBeDisabled()
    await button.click({ force: true })

    expect(onClick).not.toHaveBeenCalled()
  })

  it('while loading keeps its name, its width and the focus, and is not pressed twice', async () => {
    const onClick = vi.fn()
    const screen = await mount(Button, { props: { variant: 'primary', onClick }, slots: { default: 'Add Screen' } })
    const button = screen.getByRole('button', { name: 'Add Screen' })
    const widthAtRest = button.element().getBoundingClientRect().width
    await button.click()

    await screen.rerender({ loading: true })

    await expect.element(button).toHaveAttribute('aria-busy', 'true')
    await expect.element(button).toHaveFocus()
    expect(button.element().getBoundingClientRect().width).toBe(widthAtRest)
    await button.click({ force: true })
    await userEvent.keyboard('{Enter}')
    await userEvent.keyboard(' ')
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('shows the loading mark in place of its label while loading', async () => {
    const screen = await mount(Button, { props: { loading: true }, slots: { default: 'Update now' } })
    const button = screen.getByRole('button', { name: 'Update now' }).element()

    const mark = button.querySelector<HTMLElement>('[aria-hidden="true"]')
    await expect.element(mark).toBeVisible()
    await vi.waitFor(() => expect(getComputedStyle(button.querySelector('.label')!).opacity).toBe('0'))
  })

  it('as a child of a link is a link to assistive technology, looks like the button and navigates', async () => {
    const screen = await mountPage({
      at: '/devices',
      routes: [
        {
          path: '/devices',
          component: defineComponent(() => () => h(Button, { variant: 'primary', asChild: true }, () => h(RouterLink, { to: '/devices/add' }, () => 'Connect a Device'))),
        },
        { path: '/devices/add', component: defineComponent(() => () => h('h1', 'Connect a Device')) },
      ],
    })
    const link = screen.getByRole('link', { name: 'Connect a Device' })

    await expect.element(link).toBeVisible()
    await expect.element(screen.getByRole('button')).not.toBeInTheDocument()
    await expect.element(link).toHaveStyle({ color: 'rgb(255, 255, 255)', fontWeight: '600', textDecorationLine: 'none' })
    expect(link.element().getBoundingClientRect().height).toBe(32)

    await link.click()

    await expect.element(screen.getByRole('heading', { name: 'Connect a Device' })).toBeVisible()
    expect(screen.router.currentRoute.value.path).toBe('/devices/add')
  })

  it('as a child of an anchor keeps the anchor\'s address', async () => {
    const screen = await mount(Button, {
      props: { asChild: true },
      slots: { default: () => h('a', { href: 'https://github.com/PhyberApex/kuroshiro' }, 'Kuroshiro on GitHub') },
    })

    await expect.element(screen.getByRole('link', { name: 'Kuroshiro on GitHub' }))
      .toHaveAttribute('href', 'https://github.com/PhyberApex/kuroshiro')
  })

  it('is 32 px high, and 44 px at a coarse pointer', async () => {
    const screen = await mount(Button, { slots: { default: 'Update now' } })
    const button = screen.getByRole('button', { name: 'Update now' }).element()

    expect(button.getBoundingClientRect().height).toBe(32)
    await withCoarsePointer(async () => {
      expect(button.getBoundingClientRect().height).toBe(44)
    })
  })

  it('answers hover and press in 120 ms', async () => {
    const screen = await mount(Button, { slots: { default: 'Update now' } })
    const button = screen.getByRole('button', { name: 'Update now' }).element()

    await withMotionAllowed(async () => {
      const { transitionProperty, transitionDuration } = getComputedStyle(button)
      expect(transitionProperty).toBe('background-color, border-color, color, translate')
      expect(transitionDuration).toBe('0.12s, 0.12s, 0.12s, 0.12s')
    })
  })

  it('carries no red when it deletes: a destructive action is a plain button', async () => {
    const screen = await mount(ButtonGallery)
    const destructive = screen.getByRole('button', { name: 'Delete Screen' })
    const plain = screen.getByRole('button', { name: 'Update now' }).first()

    for (const theme of THEMES) {
      await forceTheme(theme)
      const { color, backgroundColor, borderTopColor } = getComputedStyle(destructive.element())
      expect([color, backgroundColor, borderTopColor].every(isGrey), `${theme}: ${color}, ${backgroundColor}, ${borderTopColor}`).toBe(true)
      expect(color).toBe(getComputedStyle(plain.element()).color)
      expect(borderTopColor).toBe(getComputedStyle(plain.element()).borderTopColor)
    }
  })

  it('is accessible and does not overflow in every state', async () => {
    await mount(ButtonGallery)

    await expectAccessible()
    await expectNoHorizontalOverflow()
  })
})
