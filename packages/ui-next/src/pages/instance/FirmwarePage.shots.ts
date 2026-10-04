import { describe, expect, it } from 'vitest'
import { fakeShellReads, mountApp } from '@/testing/app'
import { buildDeviceSummary } from '@/testing/fixtures/devices'
import { buildInstanceFacts } from '@/testing/fixtures/instance'
import { expectPageScreenshots } from '@/testing/screenshots'
import { DEVICES, fakeFirmware } from './__test__/firmwareHarness'

describe('firmware', () => {
  it('with three Devices, a Firmware whose file is missing and the earlier Firmware open', async () => {
    fakeFirmware()
    fakeShellReads({
      instance: buildInstanceFacts({ version: '0.18.0' }),
      devices: Object.values(DEVICES).map(device => buildDeviceSummary(device)),
    })
    const screen = await mountApp({ at: '/instance/firmware#earlier' })
    await expect.element(screen.getByRole('banner').getByRole('link', { name: 'Study' })).toBeVisible()
    await expect.element(screen.getByText('Replaced by 1.7.9 and no longer offered as a target.', { exact: false })).toBeVisible()
    await expect.element(screen.getByText('Kuroshiro 0.18.0')).toBeVisible()

    await expectPageScreenshots('firmware')
  })
})
