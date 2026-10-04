import { http } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import { clockTime } from '@/patterns/time'
import { expectAccessible } from '@/testing/a11y'
import { api, apiErrorResponse, apiUrl } from '@/testing/api/server'
import { expectNoHorizontalOverflow } from '@/testing/overflow'
import { fakeKitchenSettings, KITCHEN, mountSettings, rowOf, shownOf, words } from './deviceSettingsHarness'

type Screen = Awaited<ReturnType<typeof mountSettings>>

const NEXT_POLL = clockTime(new Date(KITCHEN.nextPollAt!))
const PROXIED = { ...KITCHEN, isMirrored: true, isProxied: true, mirror: { enabled: true, mac: KITCHEN.mac, apikeySet: true } }

const tucked = (screen: Screen, title: string) => screen.getByRole('button', { name: title })
const section = (id: string) => document.getElementById(id)
function functionRows() {
  return [...section('special-functions')!.querySelectorAll('.function')].map(row => ({
    name: words(row.querySelector('.name')),
    says: words(row.querySelector('.does')),
    disabled: row.querySelector('button')?.disabled,
  }))
}
const copyIn = (screen: Screen, label: string) => userEvent.click(rowOf(screen, label)!.querySelector('.copy')!)
const trigger = (screen: Screen, name: string) => screen.getByRole('button', { name: `Trigger ${name}` })

/** The dialog hides the page from assistive technology, so its parts are read from the DOM. */
function dialogSays() {
  const dialog = document.querySelector('[role="alertdialog"]')
  return {
    title: words(dialog?.querySelector('h2')),
    body: words(dialog?.querySelector('.body > p')),
    outcome: [...dialog?.querySelectorAll('.outcome > div') ?? []].map(part => `${words(part.querySelector('dt'))} ${words(part.querySelector('dd'))}`),
  }
}

describe('identity and credentials', () => {
  it('shows the friendly id and the MAC address, which copies', async () => {
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue()
    fakeKitchenSettings()
    const screen = await mountSettings('#identity')

    await expect.poll(() => shownOf(screen, 'Friendly id')).toBe('4F2A1C')
    expect(words(rowOf(screen, 'MAC address')?.querySelector('code'))).toBe(KITCHEN.mac)

    await copyIn(screen, 'MAC address')

    expect(writeText).toHaveBeenCalledWith(KITCHEN.mac)
  })

  it('shows only the last four characters of the API key until "Reveal", hides it again, and copies it whole either way', async () => {
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue()
    fakeKitchenSettings()
    const screen = await mountSettings('#identity')
    const shown = () => words(rowOf(screen, 'API key')?.querySelector('code'))

    await expect.poll(shown).toBe('••••••••••••••••••a91e')
    await copyIn(screen, 'API key')
    expect(writeText).toHaveBeenLastCalledWith(KITCHEN.apikey)

    await screen.getByRole('button', { name: 'Reveal' }).click()
    await expect.poll(shown).toBe(KITCHEN.apikey)
    await copyIn(screen, 'API key')
    expect(writeText).toHaveBeenCalledTimes(2)
    expect(writeText).toHaveBeenLastCalledWith(KITCHEN.apikey)

    await screen.getByRole('button', { name: 'Hide' }).click()
    await expect.poll(shown).toBe('••••••••••••••••••a91e')
    expect(rowOf(screen, 'API key')?.querySelector('input')).toBeNull()
    await expectAccessible()
    await expectNoHorizontalOverflow()
  })
})

describe('special Functions', () => {
  it('offers the four a Device acts on, each with what it does', async () => {
    fakeKitchenSettings()
    const screen = await mountSettings('#special-functions')

    await expect.element(screen.getByText('A one-shot command that reaches Kitchen at its next poll and fires once.', { exact: false })).toBeVisible()
    expect(words(section('special-functions')?.querySelector('.intro'))).toBe('A one-shot command that reaches Kitchen at its next poll and fires once. The sleep Special Function is separate from Sleep Mode.')
    expect(functionRows()).toEqual([
      { name: 'identify', says: 'Shows the Device\'s identification screen once', disabled: false },
      { name: 'sleep', says: 'Puts the Device to sleep until its button is pressed', disabled: false },
      { name: 'add_wifi', says: 'Opens Wi-Fi setup so another network can be added', disabled: false },
      { name: 'rewind', says: 'Shows the previous Screen again', disabled: false },
    ])
  })

  it('"Trigger" sends it, shows the pending line in its place and disables every "Trigger"', async () => {
    const faked = fakeKitchenSettings()
    const screen = await mountSettings('#special-functions')

    await trigger(screen, 'identify').click()

    await expect.poll(() => functionRows()[0]?.says).toBe(`Pending, reaches Kitchen around ${NEXT_POLL}`)
    expect(faked.writes).toEqual([{ specialFunction: 'identify' }])
    expect(functionRows().map(row => row.disabled)).toEqual([true, true, true, true])
    expect(functionRows().slice(1).map(row => row.says)).toEqual(['Puts the Device to sleep until its button is pressed', 'Opens Wi-Fi setup so another network can be added', 'Shows the previous Screen again'])
    await expectAccessible()
  })

  it('opens by itself while one is pending', async () => {
    fakeKitchenSettings({ device: { ...KITCHEN, pending: { ...KITCHEN.pending, specialFunction: 'rewind' } } })
    const screen = await mountSettings()

    await expect.element(tucked(screen, 'Special Functions')).toHaveAttribute('aria-expanded', 'true')
    expect(functionRows()[3]?.says).toBe(`Pending, reaches Kitchen around ${NEXT_POLL}`)
    await expect.element(tucked(screen, 'Identity and credentials')).toHaveAttribute('aria-expanded', 'false')
  })

  it('says why a refused one was not sent', async () => {
    const faked = fakeKitchenSettings()
    faked.refusing = apiErrorResponse({ statusCode: 403, code: 'demo-mode' })
    const screen = await mountSettings('#special-functions')

    await trigger(screen, 'sleep').click()

    await expect.element(screen.getByText('Not saved. Not available in the demo.')).toBeVisible()
    expect(functionRows().map(row => row.disabled)).toEqual([false, false, false, false])
  })

  it('never reaches a Proxied Device, so every "Trigger" is disabled', async () => {
    const faked = fakeKitchenSettings({ device: PROXIED })
    const screen = await mountSettings('#special-functions')

    await expect.element(screen.getByText('Kitchen is a Proxied Device. TRMNL answers its polls, so a Special Function triggered here never reaches it.')).toBeVisible()
    expect(functionRows().map(row => row.disabled)).toEqual([true, true, true, true])
    await trigger(screen, 'identify').click({ force: true })
    expect(faked.writes).toEqual([])
  })
})

describe('reset or delete a Device', () => {
  it('says what a Device Reset and deleting do', async () => {
    fakeKitchenSettings()
    const screen = await mountSettings('#reset')

    await expect.element(screen.getByText('A Device Reset makes Kitchen erase its Wi-Fi credentials and this server\'s URL at its next poll, so someone has to set it up by hand again. Nothing here is lost.')).toBeVisible()
    await expect.element(screen.getByText('Deleting removes Kitchen, its 6 Screens, their Schedules and its Device Log from this Instance.')).toBeVisible()
  })

  it('a Device Reset confirms with what is lost and what stays, then shows its pending line with the button disabled', async () => {
    const faked = fakeKitchenSettings()
    const screen = await mountSettings('#reset')

    await screen.getByRole('button', { name: 'Device Reset' }).click()

    await expect.element(screen.getByRole('alertdialog', { name: 'Reset Kitchen?' })).toBeVisible()
    expect(dialogSays()).toEqual({
      title: 'Reset Kitchen?',
      body: `At its next poll, around ${NEXT_POLL}, Kitchen erases what it has stored and restarts into Wi-Fi setup. You need to be at the Device afterwards and enter the Wi-Fi and this server's URL again.`,
      outcome: [
        'Lost On the Device: its Wi-Fi credentials, its API key and this server\'s URL.',
        'Stays Everything here: Kitchen, its Screens, Schedules and Device Log. It gets the same API key back.',
      ],
    })
    await expect.element(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus()
    expect(faked.writes).toEqual([])
    await expectAccessible()

    await screen.getByRole('alertdialog').getByRole('button', { name: 'Device Reset' }).click()

    await expect.element(screen.getByText(`Device Reset pending, reaches Kitchen around ${NEXT_POLL}`)).toBeVisible()
    expect(faked.writes).toEqual([{ resetDevice: true }])
    await expect.element(screen.getByRole('button', { name: 'Device Reset' })).toBeDisabled()
  })

  it('never reaches a Proxied Device, so the Device Reset is disabled', async () => {
    fakeKitchenSettings({ device: PROXIED })
    const screen = await mountSettings('#reset')

    await expect.element(screen.getByText('Kitchen is a Proxied Device, so a Device Reset triggered here never reaches it.')).toBeVisible()
    await expect.element(screen.getByRole('button', { name: 'Device Reset' })).toBeDisabled()
    await expect.element(screen.getByRole('button', { name: 'Delete Kitchen' })).toBeEnabled()
  })

  it('deleting confirms, names the number of Screens lost, and opens / afterwards', async () => {
    const faked = fakeKitchenSettings()
    const screen = await mountSettings('#reset')

    await screen.getByRole('button', { name: 'Delete Kitchen' }).click()

    await expect.element(screen.getByRole('alertdialog', { name: 'Delete Kitchen?' })).toBeVisible()
    expect(dialogSays().outcome).toEqual([
      'Lost Kitchen, its 6 Screens with their Schedules, and its Device Log.',
      'Stays Your Plugins. The Device itself keeps working until it next polls and is then registered again as a new Device.',
    ])
    expect(faked.deleted).toBe(0)

    await screen.getByRole('alertdialog').getByRole('button', { name: 'Delete Kitchen' }).click()

    await expect.poll(() => screen.router.currentRoute.value.path).toBe('/connect')
    expect(faked.deleted).toBe(1)
    expect(screen.getByRole('banner').getByRole('link', { name: 'Kitchen' }).elements()).toEqual([])
  })

  it('keeps the confirmation open and says why when deleting is refused', async () => {
    fakeKitchenSettings()
    api.use(http.delete(apiUrl('devices/kitchen'), () => apiErrorResponse({ statusCode: 403, code: 'demo-mode' })))
    const screen = await mountSettings('#reset')

    await screen.getByRole('button', { name: 'Delete Kitchen' }).click()
    await screen.getByRole('alertdialog').getByRole('button', { name: 'Delete Kitchen' }).click()

    await expect.element(screen.getByText('Not available in the demo.')).toBeVisible()
    expect(screen.router.currentRoute.value.path).toBe('/devices/kitchen/settings')
  })
})
