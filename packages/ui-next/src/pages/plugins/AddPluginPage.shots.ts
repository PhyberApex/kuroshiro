import { describe, expect, it } from 'vitest'
import { fakeShellReads, mountApp } from '@/testing/app'
import { buildDeviceSummary } from '@/testing/fixtures/devices'
import { expectPageScreenshots } from '@/testing/screenshots'

describe('add a Plugin', () => {
  it('building a Webhook Plugin for a Device, with its name entered', async () => {
    fakeShellReads({ devices: [buildDeviceSummary({ id: 'kitchen', name: 'Kitchen' })] })
    const screen = await mountApp({ at: '/plugins/new?way=webhook&device=kitchen' })

    await expect.element(screen.getByRole('link', { name: 'Kitchen\'s Screens' })).toBeVisible()
    const name = screen.getByRole('textbox', { name: 'Name' })
    await name.fill('Doorbell note')
    ;(name.element() as HTMLElement).blur()
    await expect.element(screen.getByRole('radio', { name: 'Replace', exact: true })).toBeChecked()
    await expectPageScreenshots('add-plugin')
  })
})
