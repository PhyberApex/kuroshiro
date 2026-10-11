import { describe, expect, it } from 'vitest'
import { expectPageScreenshots } from '@/testing/screenshots'
import { fakeFirmware, mountInstancePageForShot } from './__test__/firmwareHarness'

describe('firmware', () => {
  it('with three Devices, a Firmware whose file is missing and the earlier Firmware open', async () => {
    fakeFirmware()
    const screen = await mountInstancePageForShot('/instance/firmware#earlier')
    await expect.element(screen.getByRole('banner').getByRole('link', { name: 'Study' })).toBeVisible()
    await expect.element(screen.getByText('Replaced by 1.7.9 and no longer offered as a target.', { exact: false })).toBeVisible()
    await expect.element(screen.getByText('Kuroshiro 0.18.0')).toBeVisible()

    await expectPageScreenshots('firmware')
  })
})
