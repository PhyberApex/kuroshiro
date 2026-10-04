import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { expectAccessible } from '@/testing/a11y'
import { api, apiErrorResponse, apiUrl } from '@/testing/api/server'
import { mountApp } from '@/testing/app'
import { buildDeviceModelList } from '@/testing/fixtures/device-models'
import { expectNoHorizontalOverflow } from '@/testing/overflow'
import { elementsInSealColour } from '@/testing/sealColour'
import { SETTINGS_SECTIONS } from '../deviceSettings'
import { fakeKitchenSettings, held, KITCHEN, MODELS, mountSettings } from './deviceSettingsHarness'

const headings = (level: number) => [...document.querySelectorAll(`main h${level}`)].map(heading => heading.textContent?.trim())

describe('a Device\'s Settings', () => {
  it('opens with how they save, then the four sections and the three tucked ones', async () => {
    fakeKitchenSettings()
    const screen = await mountSettings()

    await expect.element(screen.getByText('Changes save as you make them.')).toBeVisible()
    expect(headings(2)).toEqual(['Display', 'Sleep Mode', 'Firmware', 'Mirroring', 'Identity and credentials', 'Special Functions', 'Reset or delete Kitchen'])
    for (const tucked of ['Identity and credentials', 'Special Functions', 'Reset or delete Kitchen'])
      await expect.element(screen.getByRole('button', { name: tucked })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('button', { name: /^Save/ }).elements()).toEqual([])
    await expectAccessible()
    await expectNoHorizontalOverflow()
  })

  it('answers to the fragment of each section', async () => {
    fakeKitchenSettings()
    await mountSettings()

    for (const fragment of Object.values(SETTINGS_SECTIONS))
      expect(document.getElementById(fragment), fragment).not.toBeNull()
  })

  it('opens a tucked section the address names', async () => {
    fakeKitchenSettings()
    const screen = await mountSettings('#identity')

    await expect.element(screen.getByRole('button', { name: 'Identity and credentials' })).toHaveAttribute('aria-expanded', 'true')
    await expect.element(screen.getByText('4F2A1C')).toBeVisible()
  })

  it('shows the section headings over empty rows and says what is loading, while it waits', async () => {
    fakeKitchenSettings()
    const waiting = held()
    api.use(http.get(apiUrl('device-models'), async () => {
      await waiting.promise
      return HttpResponse.json(buildDeviceModelList({ models: MODELS }))
    }))
    const screen = await mountApp({ at: '/devices/kitchen/settings' })

    await expect.element(screen.getByText('Loading Kitchen\'s Settings')).toBeVisible()
    expect([...document.querySelectorAll('main [aria-hidden="true"] h2')].map(heading => heading.textContent?.trim()))
      .toEqual(['Display', 'Sleep Mode', 'Firmware', 'Mirroring'])
    expect(screen.getByRole('textbox', { name: 'Name' }).elements()).toEqual([])
    await expectAccessible()

    waiting.release()
    await expect.element(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Kitchen')
    expect(screen.getByText('Loading Kitchen\'s Settings').elements()).toEqual([])
  })

  it('says what could not be loaded and why, and tries again', async () => {
    fakeKitchenSettings()
    let refused = true
    api.use(http.get(apiUrl('firmware'), () => refused
      ? apiErrorResponse({ statusCode: 500, code: 'internal' })
      : HttpResponse.json({ lastSync: null, firmware: [] })))
    const screen = await mountApp({ at: '/devices/kitchen/settings' })

    await expect.element(screen.getByText('Could not load Kitchen\'s Settings.')).toBeVisible()
    await expect.element(screen.getByText('Something went wrong on the server.')).toBeVisible()
    expect(elementsInSealColour(screen.getByRole('main').element())).toEqual([])
    await expectAccessible()

    refused = false
    await screen.getByRole('button', { name: 'Try again' }).click()

    await expect.element(screen.getByRole('textbox', { name: 'Name' })).toHaveValue(KITCHEN.name)
    expect(screen.getByText('Could not load Kitchen\'s Settings.').elements()).toEqual([])
  })

  it('keeps the Settings under the notice when a later read of the Device fails', async () => {
    const faked = fakeKitchenSettings()
    const screen = await mountSettings()

    api.use(http.get(apiUrl('devices/kitchen'), () => apiErrorResponse({ statusCode: 500, code: 'internal' })))
    faked.device = { ...faked.device, name: 'Pantry' }
    window.dispatchEvent(new Event('focus'))

    await expect.element(screen.getByText('Could not load Kitchen\'s Settings.')).toBeVisible()
    await expect.element(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Kitchen')
  })
})
