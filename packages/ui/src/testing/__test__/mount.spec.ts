import { describe, expect, it } from 'vitest'
import { userEvent } from 'vitest/browser'
import { mount } from '../mount'
import DisclosureExample from './examples/DisclosureExample.vue'

describe('mount', () => {
  it('answers a real pointer click on a Reka UI trigger', async () => {
    const screen = await mount(DisclosureExample)
    await expect.element(screen.getByText('Polled 4 min ago')).not.toBeInTheDocument()

    await screen.getByRole('button', { name: 'Details' }).click()

    await expect.element(screen.getByText('Polled 4 min ago')).toBeVisible()
  })

  it('answers the keyboard: Tab reaches the trigger and Enter opens it', async () => {
    const screen = await mount(DisclosureExample)

    await userEvent.keyboard('{Tab}')
    await expect.element(screen.getByRole('button', { name: 'Details' })).toHaveFocus()
    await userEvent.keyboard('{Enter}')

    await expect.element(screen.getByText('Polled 4 min ago')).toBeVisible()
  })

  it('loads the tokens and the reset before the component, so the component layer wins', async () => {
    const screen = await mount(DisclosureExample)
    const trigger = screen.getByRole('button', { name: 'Details' }).element()

    expect(getComputedStyle(trigger).paddingLeft).toBe('12px')
    expect(getComputedStyle(document.body).fontFamily).toContain('Archivo Variable')
  })

  it('forces the light theme unless a test asks for dark', async () => {
    await mount(DisclosureExample)
    expect(getComputedStyle(document.body).backgroundColor).toBe('rgb(255, 255, 255)')

    await mount(DisclosureExample, { theme: 'dark' })
    expect(getComputedStyle(document.body).backgroundColor).toBe('rgb(18, 18, 18)')
  })
})
