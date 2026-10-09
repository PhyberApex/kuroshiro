import type { DeviceDetail } from 'kuroshiro-shared'
import { describe, expect, it } from 'vitest'
import { clockTime } from '@/patterns/time'
import { expectAccessible } from '@/testing/a11y'
import { apiErrorResponse } from '@/testing/api/server'
import { buildInstanceSettings } from '@/testing/fixtures/instance'
import { expectNoHorizontalOverflow } from '@/testing/overflow'
import { choose, fakeKitchenSettings, KITCHEN, mountSettings, noteOf, offeredBy, rowOf, shownOf, stateOf, words } from './deviceSettingsHarness'

type Screen = Awaited<ReturnType<typeof mountSettings>>

const OFFICIAL: DeviceDetail['targetFirmware'] = { id: 'fw-official', version: '1.7.9', kind: 'official-synced', label: null, deprecated: false }
const NEXT_POLL = clockTime(new Date(KITCHEN.nextPollAt!))

const target = (screen: Screen) => screen.getByRole('combobox', { name: 'Target Firmware' })
const updateNow = (screen: Screen) => screen.getByRole('button', { name: 'Update now' })
const cancelPush = (screen: Screen) => screen.getByRole('button', { name: 'Cancel push' })
const pendingLine = (screen: Screen) => words(rowOf(screen, 'Target Firmware')?.querySelector('.pending'))
const section = () => document.getElementById('firmware')

describe('the Firmware of a Device', () => {
  it('shows the reported version, or that none was reported yet', async () => {
    fakeKitchenSettings()
    const screen = await mountSettings()

    expect(shownOf(screen, 'Reported version')).toBe('1.7.8')
  })

  it('says "Not reported yet" until the first poll', async () => {
    fakeKitchenSettings({ device: { ...KITCHEN, reported: { ...KITCHEN.reported, firmwareVersion: null } } })
    const screen = await mountSettings()

    expect(shownOf(screen, 'Reported version')).toBe('Not reported yet')
  })

  it('offers "None", then only Firmware that fits the Device Model and is not deprecated', async () => {
    fakeKitchenSettings()
    const screen = await mountSettings()

    await expect.element(target(screen)).toHaveTextContent('None')
    expect(await offeredBy(screen, 'Target Firmware')).toEqual(['None', '1.8.0-rc2 · custom · Kitchen test build', '1.7.9 · official'])
    expect(noteOf(screen, 'Target Firmware')).toBe('Only Firmware that fits TRMNL OG (2-bit) is listed.')
    await expect.element(updateNow(screen)).toBeDisabled()
  })

  it('keeps the assigned Firmware in the list though it is deprecated', async () => {
    fakeKitchenSettings({ device: { ...KITCHEN, targetFirmware: { id: 'fw-retired', version: '1.6.9', kind: 'official-synced', label: null, deprecated: true } } })
    const screen = await mountSettings()

    await expect.element(target(screen)).toHaveTextContent('1.6.9 · official')
    expect(await offeredBy(screen, 'Target Firmware')).toContain('1.6.9 · official')
  })

  it('choosing a target sends it without a push', async () => {
    const faked = fakeKitchenSettings()
    const screen = await mountSettings()

    await choose(screen, 'Target Firmware', '1.7.9 · official')

    await expect.poll(() => stateOf(screen, 'Target Firmware')).toBe('Saved')
    expect(faked.writes).toEqual([{ targetFirmwareId: 'fw-official' }])
    await expect.element(updateNow(screen)).toBeEnabled()
    expect(pendingLine(screen)).toBe('')
  })

  it('"None" clears the target', async () => {
    const faked = fakeKitchenSettings({ device: { ...KITCHEN, targetFirmware: OFFICIAL } })
    const screen = await mountSettings()

    await choose(screen, 'Target Firmware', 'None')

    await expect.poll(() => faked.writes).toEqual([{ targetFirmwareId: null }])
    await expect.element(updateNow(screen)).toBeDisabled()
  })

  it('"Update now" sends the push and says when it goes out, with the button disabled', async () => {
    const faked = fakeKitchenSettings({ device: { ...KITCHEN, targetFirmware: OFFICIAL } })
    const screen = await mountSettings()

    await updateNow(screen).click()

    await expect.poll(() => pendingLine(screen)).toBe(`Goes out at the next poll, around ${NEXT_POLL}`)
    expect(faked.writes).toEqual([{ updateFirmware: true }])
    await expect.element(updateNow(screen)).toBeDisabled()
  })

  it('cannot go back to "None" while a push is pending', async () => {
    fakeKitchenSettings({ device: { ...KITCHEN, targetFirmware: OFFICIAL, pending: { ...KITCHEN.pending, firmwarePush: true } } })
    const screen = await mountSettings()

    await target(screen).click()

    await expect.element(screen.getByRole('option', { name: 'None A push is pending', exact: true })).toHaveAttribute('aria-disabled', 'true')
  })

  it('has no "Cancel push" while there is no pending push', async () => {
    fakeKitchenSettings({ device: { ...KITCHEN, targetFirmware: OFFICIAL } })
    const screen = await mountSettings()

    expect(cancelPush(screen).elements()).toEqual([])
  })

  it('cancels a pending push: it stops the push, keeps the target and un-disables "Update now" and "None"', async () => {
    const faked = fakeKitchenSettings({ device: { ...KITCHEN, targetFirmware: OFFICIAL, pending: { ...KITCHEN.pending, firmwarePush: true } } })
    const screen = await mountSettings()

    await expect.element(cancelPush(screen)).toBeEnabled()
    await cancelPush(screen).click()

    await expect.poll(() => cancelPush(screen).elements()).toEqual([])
    expect(faked.writes).toEqual([{ updateFirmware: false }])
    expect(pendingLine(screen)).toBe('')
    await expect.element(target(screen)).toHaveTextContent('1.7.9 · official')
    await expect.element(updateNow(screen)).toBeEnabled()
    await target(screen).click()
    await expect.element(screen.getByRole('option', { name: 'None' })).not.toHaveAttribute('aria-disabled')
  })

  it('says "at the next poll" without a time once that moment has passed', async () => {
    fakeKitchenSettings({ device: { ...KITCHEN, nextPollAt: '2026-10-03T07:30:00.000Z', targetFirmware: OFFICIAL, pending: { ...KITCHEN.pending, firmwarePush: true } } })
    const screen = await mountSettings()

    expect(pendingLine(screen)).toBe('Goes out at the next poll')
  })

  it('words a refused push and offers to try again', async () => {
    const faked = fakeKitchenSettings({ device: { ...KITCHEN, targetFirmware: OFFICIAL } })
    faked.refusing = apiErrorResponse({ statusCode: 409, code: 'firmware-push-mirrored' })
    const screen = await mountSettings()

    await updateNow(screen).click()

    await expect.poll(() => stateOf(screen, 'Target Firmware')).toBe('Not saved. A mirrored Device is not given Firmware.')
    await expect.element(screen.getByRole('button', { name: 'Try again' })).toBeVisible()
    expect(pendingLine(screen)).toBe('')
  })

  it('words a refused cancel and offers to try again, with the push still pending', async () => {
    const faked = fakeKitchenSettings({ device: { ...KITCHEN, targetFirmware: OFFICIAL, pending: { ...KITCHEN.pending, firmwarePush: true } } })
    faked.refusing = apiErrorResponse({ statusCode: 500, code: 'internal' })
    const screen = await mountSettings()

    await cancelPush(screen).click()

    await expect.poll(() => stateOf(screen, 'Target Firmware')).toBe('Not saved. Something went wrong on the server.')
    await expect.element(screen.getByRole('button', { name: 'Try again' })).toBeVisible()
    await expect.element(cancelPush(screen)).toBeEnabled()
  })

  it('is off while Mirroring', async () => {
    fakeKitchenSettings({ device: { ...KITCHEN, isMirrored: true, mirror: { enabled: true, mac: 'A4:CF:12:9B:01:7E', apikeySet: true } } })
    const screen = await mountSettings()

    expect(shownOf(screen, 'Target Firmware')).toBe('Off while Mirroring')
    expect(updateNow(screen).elements()).toEqual([])
    expect(target(screen).elements()).toEqual([])
  })

  it('is set by TRMNL on a Proxied Device', async () => {
    fakeKitchenSettings({ device: { ...KITCHEN, isMirrored: true, isProxied: true, mirror: { enabled: true, mac: KITCHEN.mac, apikeySet: true } } })
    const screen = await mountSettings()

    expect(shownOf(screen, 'Target Firmware')).toBe('Set by TRMNL')
  })

  it('links to the Firmware library and says Firmware Auto-Update is off', async () => {
    fakeKitchenSettings()
    const screen = await mountSettings()

    await expect.element(screen.getByRole('link', { name: 'Firmware library' })).toHaveAttribute('href', '/instance/firmware')
    expect(words(section()?.querySelector('.library'))).toBe('The Firmware library lives under Instance.')
    await expect.element(screen.getByText('Firmware Auto-Update is off, so Kitchen only updates when you press “Update now”.')).toBeVisible()
    await expectAccessible()
    await expectNoHorizontalOverflow()
  })

  it('says Firmware Auto-Update is on', async () => {
    fakeKitchenSettings({ settings: buildInstanceSettings({ firmwareAutoUpdate: { override: true, value: true, fallbackSource: 'default', fallbackValue: false } }) })
    const screen = await mountSettings()

    await expect.element(screen.getByText('Firmware Auto-Update is on: Kitchen is given each new official Firmware by itself.')).toBeVisible()
  })
})
