import type { DeviceSummary } from 'kuroshiro-shared'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { api, apiUrl } from '@/testing/api/server'
import { fakeShellReads, mountApp } from '@/testing/app'
import { buildDeviceSummary } from '@/testing/fixtures/devices'
import { fakeScreenImages } from '@/testing/images'
import { expectPageScreenshots } from '@/testing/screenshots'
import { freezeTime } from '@/testing/time'
import { holdTabVisible } from '@/testing/visibility'

const calledIn = buildDeviceSummary({
  id: 'new',
  name: '4F2A1C',
  friendlyId: '4F2A1C',
  firmwareVersion: '1.6.9',
  lastSeenAt: null,
  nextPollAt: null,
  batteryPercent: null,
  rssi: null,
  currentScreen: { kind: 'fallback', fallback: 'welcome', reason: 'neverPolled', screenId: null, imagePath: '/screens/welcome.png?v=1', servedAt: null },
})

describe('connect a Device', () => {
  it('on the first run, once a Device has called in', async () => {
    freezeTime('2026-10-03T07:35:00.000Z')
    holdTabVisible()
    fakeScreenImages()
    fakeShellReads()
    let devices: DeviceSummary[] = []
    api.use(http.get(apiUrl('devices'), () => HttpResponse.json(devices)))
    const screen = await mountApp({ at: '/connect' })
    await expect.element(screen.getByText('Waiting for a Device to call in')).toBeVisible()

    devices = [calledIn]

    await expect.element(screen.getByRole('link', { name: 'Open 4F2A1C' })).toBeVisible()
    await expect.element(screen.getByRole('banner').getByRole('link', { name: '4F2A1C' })).toBeVisible()
    await expect.poll(() => [...document.images].every(image => image.complete)).toBe(true)

    await expectPageScreenshots('connect')
  })
})
