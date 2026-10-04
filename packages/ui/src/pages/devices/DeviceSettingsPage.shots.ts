import { describe, expect, it } from 'vitest'
import { expectPageScreenshots } from '@/testing/screenshots'
import { fakeKitchenSettings, KITCHEN, mountSettings } from './__test__/deviceSettingsHarness'

describe('the Settings of a Device', () => {
  it('with every section open, Sleep Mode on, a target Firmware and a Special Function pending', async () => {
    fakeKitchenSettings({
      device: {
        ...KITCHEN,
        sleep: { enabled: true, start: '23:00', end: '06:00', whileAsleep: 'fallback', inWindow: false, endsAt: null },
        targetFirmware: { id: 'fw-official', version: '1.7.9', kind: 'official-synced', label: null, deprecated: false },
        pending: { specialFunction: 'identify', deviceReset: false, firmwarePush: false },
      },
    })
    const screen = await mountSettings('#identity')
    await expect.element(screen.getByRole('banner').getByRole('link', { name: 'Kitchen' })).toBeVisible()
    await expect.element(screen.getByText('Server timezone, Europe/Berlin')).toBeVisible()

    // Opened without the pointer, which the shot files share.
    screen.getByRole('button', { name: 'Reset or delete Kitchen' }).element().dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await expect.element(screen.getByRole('button', { name: 'Delete Kitchen' })).toBeVisible()
    await expect.element(screen.getByText('Pending, reaches Kitchen around', { exact: false })).toBeVisible()

    await expectPageScreenshots('device-settings')
  })
})
