import { describe, expect, it } from 'vitest'
import { expectPageScreenshots } from '@/testing/screenshots'
import { freezeTime } from '@/testing/time'
import { fakeSimulator, mountSimulator } from './__test__/simulatorHarness'

describe('device simulator', () => {
  it('before a poll, three Devices', async () => {
    freezeTime('2026-10-03T07:35:00.000Z')
    fakeSimulator()
    const screen = await mountSimulator('/instance/simulator?device=kitchen')
    await expect.element(screen.getByRole('banner').getByRole('link', { name: 'Kitchen' })).toBeVisible()
    await expect.element(screen.getByRole('button', { name: 'Poll as Kitchen' })).toBeEnabled()

    await expectPageScreenshots('device-simulator')
  })
})
