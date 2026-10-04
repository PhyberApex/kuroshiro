import { describe, expect, it } from 'vitest'
import { fakeShellReads, mountApp } from '@/testing/app'
import { buildAlert, buildAlertsList } from '@/testing/fixtures/alerts'
import { buildDeviceSummary } from '@/testing/fixtures/devices'
import { buildInstanceFacts } from '@/testing/fixtures/instance'
import { expectPageScreenshots } from '@/testing/screenshots'
import StandInPage from './__test__/examples/StandInPage.vue'

const devices = ['Hallway', 'Kitchen', 'Study'].map((name, index) => buildDeviceSummary({ id: `device-${index}`, name }))

// A stand-in page under the real shell, so the shell's baselines do not change when a page lands.
describe('shell baselines', () => {
  it('the shell around a page that is loading, with an Alert firing', async () => {
    fakeShellReads({ devices, alerts: buildAlertsList({ active: [buildAlert()] }) })
    const screen = await mountApp({ at: '/plugins', routes: [{ path: '/plugins', component: StandInPage }] })
    await expect.element(screen.getByRole('link', { name: '1 Alert firing' })).toBeVisible()

    await expectPageScreenshots('shell')
  })

  it('the shell in demo mode on a first run', async () => {
    fakeShellReads({ devices: [], instance: buildInstanceFacts({ demoMode: true }) })
    const screen = await mountApp({ at: '/nowhere', routes: [{ path: '/:unknown(.*)*', component: () => import('@/pages/NotFoundPage.vue') }] })
    await expect.element(screen.getByText(/This is the Kuroshiro demo/)).toBeVisible()
    await expect.element(screen.getByRole('heading', { name: 'No page here' })).toBeVisible()

    await expectPageScreenshots('shell-demo-first-run')
  })
})
