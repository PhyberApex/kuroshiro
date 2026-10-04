import { describe, expect, it } from 'vitest'
import { expectPageScreenshots } from '@/testing/screenshots'
import { freezeTime } from '@/testing/time'
import { fakeHousekeeping, mountHousekeeping } from './__test__/housekeepingHarness'

describe('housekeeping', () => {
  it('with findings in every group and the last Retention Run', async () => {
    freezeTime('2026-10-03T07:35:00.000Z')
    fakeHousekeeping()
    const screen = await mountHousekeeping()
    await expect.element(screen.getByRole('banner').getByRole('link', { name: 'Kitchen' })).toBeVisible()
    await expect.element(screen.getByRole('button', { name: 'Clean up 4 groups' })).toBeVisible()
    await expect.element(screen.getByText('Last Retention Run', { exact: false })).toBeVisible()

    await expectPageScreenshots('housekeeping')
  })
})
