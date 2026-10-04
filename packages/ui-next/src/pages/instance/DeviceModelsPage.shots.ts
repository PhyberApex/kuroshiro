import { describe, expect, it } from 'vitest'
import { fakeShellReads, mountApp } from '@/testing/app'
import { buildDeviceSummary } from '@/testing/fixtures/devices'
import { buildInstanceFacts } from '@/testing/fixtures/instance'
import { expectPageScreenshots } from '@/testing/screenshots'
import { fakeDeviceModels } from './__test__/deviceModelsHarness'
import { DEVICES } from './__test__/firmwareHarness'

describe('device models and palettes', () => {
  it('with three Devices, two custom Palettes and the other Device Models open', async () => {
    fakeDeviceModels()
    fakeShellReads({
      instance: buildInstanceFacts({ version: '0.18.0' }),
      devices: Object.values(DEVICES).map(device => buildDeviceSummary(device)),
    })
    const screen = await mountApp({ at: '/instance/models#other-device-models' })
    await expect.element(screen.getByRole('banner').getByRole('link', { name: 'Study' })).toBeVisible()
    await expect.element(screen.getByRole('searchbox', { name: 'Find a Device Model' })).toBeVisible()
    await expect.element(screen.getByText('Kuroshiro 0.18.0')).toBeVisible()

    await expectPageScreenshots('device-models')
  })
})
