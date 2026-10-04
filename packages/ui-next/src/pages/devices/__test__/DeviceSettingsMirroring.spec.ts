import { describe, expect, it } from 'vitest'
import { userEvent } from 'vitest/browser'
import { expectAccessible } from '@/testing/a11y'
import { expectNoHorizontalOverflow } from '@/testing/overflow'
import { errorOf, fakeKitchenSettings, KITCHEN, mountSettings, noteOf, rowOf, shownOf, stateOf, words } from './deviceSettingsHarness'

type Screen = Awaited<ReturnType<typeof mountSettings>>

const OTHER_MAC = 'A4:CF:12:9B:01:7E'
const MIRRORED = { ...KITCHEN, isMirrored: true, mirror: { enabled: true, mac: OTHER_MAC, apikeySet: true } }

const mirroring = (screen: Screen) => screen.getByRole('switch', { name: 'Mirroring' })
const mac = (screen: Screen) => screen.getByRole('textbox', { name: 'Mirror MAC address' })
const key = (screen: Screen) => screen.getByLabelText('Mirror API key')
const switchSays = (screen: Screen) => words(rowOf(screen, 'Mirroring')?.querySelector('.control-cell'))

async function enter(field: ReturnType<typeof mac>, value: string) {
  await field.fill(value)
  await userEvent.keyboard('{Enter}')
}

describe('mirroring', () => {
  it('is off without its two fields, under what it does', async () => {
    fakeKitchenSettings()
    const screen = await mountSettings()

    await expect.element(mirroring(screen)).toHaveAttribute('aria-checked', 'false')
    expect(switchSays(screen)).toBe('Off')
    expect(rowOf(screen, 'Mirror MAC address')).toBeUndefined()
    await expect.element(screen.getByText('Kitchen shows the image of a Device on TRMNL\'s own server instead of its own Screens. While it is on, Rotation, Sleep Mode and Firmware pushes do not apply to Kitchen; its Screens are kept.')).toBeVisible()
  })

  it('switched on, sends nothing until the MAC address and the API key are both valid', async () => {
    const faked = fakeKitchenSettings()
    const screen = await mountSettings()

    await mirroring(screen).click()

    await expect.element(mac(screen)).toBeVisible()
    expect(noteOf(screen, 'Mirroring')).toBe('Not on yet. Enter the mirror MAC address and API key.')
    await expect.element(key(screen)).toHaveAttribute('type', 'password')
    expect(noteOf(screen, 'Mirror MAC address')).toBe('The MAC address of the Device on TRMNL\'s server whose image is shown.')
    expect(noteOf(screen, 'Mirror API key')).toBe('That Device\'s API key on TRMNL.')

    await enter(mac(screen), 'a4:cf:12:9b:01:7e')
    await expect.element(mac(screen)).toHaveValue(OTHER_MAC)
    expect(faked.writes).toEqual([])

    await enter(key(screen), 'trmnl-secret')

    await expect.poll(() => faked.writes).toEqual([{ mirrorEnabled: true, mirrorMac: OTHER_MAC, mirrorApikey: 'trmnl-secret' }])
    await expect.poll(() => stateOf(screen, 'Mirror API key')).toBe('Saved')
    await expect.poll(() => noteOf(screen, 'Mirroring')).toBe('')
    expect(switchSays(screen)).toBe('On')
  })

  it('refuses a MAC address that is not six pairs of hex digits, on the field', async () => {
    const faked = fakeKitchenSettings()
    const screen = await mountSettings()
    await mirroring(screen).click()

    await enter(mac(screen), 'A4:CF:12')

    await expect.poll(() => errorOf(screen, 'Mirror MAC address')).toBe('Enter a MAC address like A4:CF:12:00:00:00.')
    await expect.element(mac(screen)).toHaveAttribute('aria-invalid', 'true')
    await enter(key(screen), 'trmnl-secret')
    expect(faked.writes).toEqual([])
    await expectAccessible()
  })

  it('switched off, saves at once and keeps both values', async () => {
    const faked = fakeKitchenSettings({ device: MIRRORED })
    const screen = await mountSettings()
    await expect.element(mac(screen)).toHaveValue(OTHER_MAC)

    await mirroring(screen).click()

    await expect.poll(() => faked.writes).toEqual([{ mirrorEnabled: false }])
    await expect.poll(() => rowOf(screen, 'Mirror MAC address')).toBeUndefined()
    expect(faked.device.mirror).toEqual({ enabled: false, mac: OTHER_MAC, apikeySet: true })
  })

  it('switched on again with both values kept, saves at once', async () => {
    const faked = fakeKitchenSettings({ device: { ...KITCHEN, mirror: { enabled: false, mac: OTHER_MAC, apikeySet: true } } })
    const screen = await mountSettings()

    await mirroring(screen).click()

    await expect.poll(() => faked.writes).toEqual([{ mirrorEnabled: true }])
    await expect.poll(() => stateOf(screen, 'Mirroring')).toBe('Saved')
    await expect.element(mac(screen)).toHaveValue(OTHER_MAC)
  })

  it('never shows a stored API key, and sends a replaced one alone', async () => {
    const faked = fakeKitchenSettings({ device: MIRRORED })
    const screen = await mountSettings()

    expect(words(rowOf(screen, 'Mirror API key')?.querySelector('.visually-hidden'))).toBe('A value is stored and is not shown.')
    expect(rowOf(screen, 'Mirror API key')?.querySelector('input')).toBeNull()

    await screen.getByRole('button', { name: 'Replace mirror API key' }).click()
    await enter(key(screen), 'another-secret')

    await expect.poll(() => faked.writes).toEqual([{ mirrorApikey: 'another-secret' }])
    await expect.poll(() => stateOf(screen, 'Mirror API key')).toBe('Saved')
    await userEvent.keyboard('{Tab}')
    await expect.poll(() => rowOf(screen, 'Mirror API key')?.querySelector('input')).toBeNull()
  })

  it('sends a changed MAC address alone while Mirroring is on', async () => {
    const faked = fakeKitchenSettings({ device: MIRRORED })
    const screen = await mountSettings()

    await enter(mac(screen), 'A4:CF:12:00:00:01')

    await expect.poll(() => faked.writes).toEqual([{ mirrorMac: 'A4:CF:12:00:00:01' }])
    await expect.poll(() => stateOf(screen, 'Mirror MAC address')).toBe('Saved')
  })

  it('"Use Kitchen\'s own" fills in the Device\'s MAC address, which makes it a Proxied Device', async () => {
    const faked = fakeKitchenSettings({ device: MIRRORED })
    const screen = await mountSettings()

    await screen.getByRole('button', { name: 'Use Kitchen\'s own' }).click()

    await expect.poll(() => faked.writes).toEqual([{ mirrorMac: KITCHEN.mac }])
    await expect.poll(() => noteOf(screen, 'Mirror MAC address')).toBe('This is Kitchen\'s own MAC address, which makes it a Proxied Device: its whole poll is forwarded and TRMNL answers it.')
    expect(screen.getByRole('button', { name: 'Use Kitchen\'s own' }).elements()).toEqual([])
    await expect.poll(() => shownOf(screen, 'Refresh rate')).toBe('Set by TRMNL')
    await expectAccessible()
    await expectNoHorizontalOverflow()
  })
})
