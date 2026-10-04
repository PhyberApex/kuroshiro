import { afterEach, describe, expect, it, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import { expectAccessible } from '@/testing/a11y'
import { withCoarsePointer } from '@/testing/media'
import { mount } from '@/testing/mount'
import { expectNoHorizontalOverflow } from '@/testing/overflow'
import CopyValueGallery from '../CopyValue.gallery.vue'
import CopyValue from '../CopyValue.vue'

const MAC = 'A4:C1:38:5F:0B:9E'

afterEach(() => vi.unstubAllGlobals())

describe('copy value', () => {
  it('shows the value in mono beside a button that names what it does', async () => {
    const screen = await mount(CopyValue, { props: { value: MAC } })

    await expect.element(screen.getByText(MAC)).toBeVisible()
    expect(getComputedStyle(screen.getByText(MAC).element()).fontFamily).toContain('JetBrains Mono')
    await expect.element(screen.getByRole('button', { name: 'Copy' })).toHaveAccessibleDescription(MAC)
    await expect.element(screen.getByRole('status')).toBeEmptyDOMElement()
  })

  it('writes the value to the clipboard, then shows and announces "Copied"', async () => {
    const screen = await mount(CopyValue, { props: { value: MAC } })

    await screen.getByRole('button', { name: 'Copy' }).click()

    await expect.element(screen.getByRole('button', { name: 'Copied' })).toBeVisible()
    await expect.element(screen.getByRole('status')).toHaveTextContent('Copied')
    expect(await navigator.clipboard.readText()).toBe(MAC)
  })

  it('works by keyboard', async () => {
    const screen = await mount(CopyValue, { props: { value: 'kuro-0042' } })

    await userEvent.keyboard('{Tab}')
    await expect.element(screen.getByRole('button', { name: 'Copy' })).toHaveFocus()
    await userEvent.keyboard('{Enter}')

    await expect.element(screen.getByRole('status')).toHaveTextContent('Copied')
    await expect.element(screen.getByRole('button', { name: 'Copied' })).toHaveFocus()
    expect(await navigator.clipboard.readText()).toBe('kuro-0042')
  })

  it('reverts by itself after two seconds, without growing or shrinking', async () => {
    const screen = await mount(CopyValue, { props: { value: MAC } })
    const button = screen.getByRole('button')
    const widthAtRest = button.element().getBoundingClientRect().width
    await button.click()
    await expect.element(screen.getByRole('button', { name: 'Copied' })).toBeVisible()
    expect(button.element().getBoundingClientRect().width).toBe(widthAtRest)

    await new Promise(resolve => setTimeout(resolve, 1500))
    await expect.element(screen.getByRole('button', { name: 'Copied' })).toBeVisible()

    await expect.element(screen.getByRole('button', { name: 'Copy', exact: true })).toBeVisible()
    await expect.element(screen.getByRole('status')).toBeEmptyDOMElement()
  })

  it('copies the whole value when it shows less of it', async () => {
    const screen = await mount(CopyValue, { props: { value: 'kuro_live_9f2c41d07ab35e68' }, slots: { default: '••••5e68' } })
    await expect.element(screen.getByText('••••5e68')).toBeVisible()

    await screen.getByRole('button', { name: 'Copy' }).click()

    await expect.element(screen.getByRole('status')).toHaveTextContent('Copied')
    expect(await navigator.clipboard.readText()).toBe('kuro_live_9f2c41d07ab35e68')
  })

  it('still copies on plain HTTP, where the browser has no async clipboard', async () => {
    const screen = await mount(CopyValue, { props: { value: 'http://kuroshiro.lan:3000' } })
    const { clipboard } = navigator
    vi.stubGlobal('navigator', new Proxy(navigator, {
      get: (target, key) => key === 'clipboard' ? undefined : Reflect.get(target, key, target),
    }))

    await screen.getByRole('button', { name: 'Copy' }).click()

    await expect.element(screen.getByRole('status')).toHaveTextContent('Copied')
    await expect.element(screen.getByRole('button', { name: 'Copied' })).toHaveFocus()
    expect(await clipboard.readText()).toBe('http://kuroshiro.lan:3000')
  })

  it('at title size is the Server URL: a heavy frame and a primary "Copy URL"', async () => {
    const screen = await mount(CopyValue, { props: { value: 'http://kuroshiro.lan:3000', size: 'title', label: 'Copy URL' } })

    await expect.element(screen.getByText('http://kuroshiro.lan:3000')).toHaveStyle({ fontSize: '30px' })
    expect(getComputedStyle(screen.getByText('http://kuroshiro.lan:3000').element()).fontFamily).toContain('JetBrains Mono')
    await expect.element(screen.getByRole('button', { name: 'Copy URL' })).toHaveStyle({ color: 'rgb(255, 255, 255)' })
    expect(getComputedStyle(screen.container.firstElementChild!).borderTopWidth).toBe('2px')

    await screen.getByRole('button', { name: 'Copy URL' }).click()

    await expect.element(screen.getByRole('button', { name: 'Copied' })).toBeVisible()
    expect(await navigator.clipboard.readText()).toBe('http://kuroshiro.lan:3000')
  })

  it('has a 44 px button at a coarse pointer', async () => {
    const screen = await mount(CopyValue, { props: { value: MAC } })
    const button = screen.getByRole('button', { name: 'Copy' }).element()

    await withCoarsePointer(async () => {
      expect(button.getBoundingClientRect().height).toBeGreaterThanOrEqual(44)
    })
  })

  it('is accessible and does not overflow in both sizes and states', async () => {
    await mount(CopyValueGallery)

    await expectAccessible()
    await expectNoHorizontalOverflow()
  })
})
