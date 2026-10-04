import { describe, expect, it } from 'vitest'
import { fakeShellReads, mountApp } from '@/testing/app'
import { buildInstanceFacts } from '@/testing/fixtures/instance'
import { expectPageScreenshots } from '@/testing/screenshots'
import { fakeFirmware } from './__test__/firmwareHarness'

describe('upload Firmware', () => {
  it('with a version and a label entered and no Device Model ticked yet', async () => {
    fakeFirmware()
    fakeShellReads({ instance: buildInstanceFacts({ version: '0.18.0' }) })
    const screen = await mountApp({ at: '/instance/firmware/upload' })
    await expect.element(screen.getByRole('banner').getByRole('link', { name: 'Kitchen' })).toBeVisible()
    await screen.getByRole('textbox', { name: 'Version' }).fill('1.8.0-rc2')
    const label = screen.getByRole('textbox', { name: 'Label optional' })
    await label.fill('Release candidate, battery fix')
    ;(label.element() as HTMLElement).blur()
    await expect.element(screen.getByRole('checkbox', { name: 'TRMNL X' })).toBeVisible()
    await expect.element(screen.getByText('Kuroshiro 0.18.0')).toBeVisible()

    await expectPageScreenshots('upload-firmware')
  })
})
