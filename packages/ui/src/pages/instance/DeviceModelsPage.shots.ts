import { describe, expect, it } from 'vitest'
import { expectPageScreenshots } from '@/testing/screenshots'
import { fakeDeviceModels } from './__test__/deviceModelsHarness'
import { mountInstancePageForShot } from './__test__/firmwareHarness'

describe('device models and palettes', () => {
  it('with three Devices, two custom Palettes and the other Device Models open', async () => {
    fakeDeviceModels()
    const screen = await mountInstancePageForShot('/instance/models#other-device-models')
    await expect.element(screen.getByRole('banner').getByRole('link', { name: 'Study' })).toBeVisible()
    await expect.element(screen.getByRole('searchbox', { name: 'Find a Device Model' })).toBeVisible()
    await expect.element(screen.getByText('Kuroshiro 0.18.0')).toBeVisible()

    await expectPageScreenshots('device-models')
  })

  it.each([
    ['adding a custom Palette', 'new', 'device-models-add-palette'],
    ['editing a custom Palette a Device uses', 'study-panel', 'device-models-edit-palette'],
  ])('%s', async (_, palette, name) => {
    fakeDeviceModels()
    const screen = await mountInstancePageForShot(`/instance/models?palette=${palette}`)
    await expect.element(screen.getByRole('banner').getByRole('link', { name: 'Study' })).toBeVisible()
    await expect.element(screen.getByRole('form')).toBeVisible()
    await expect.element(screen.getByText('Kuroshiro 0.18.0')).toBeVisible()

    await expectPageScreenshots(name)
  })
})
