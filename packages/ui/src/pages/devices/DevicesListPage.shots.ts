import { describe, expect, it } from 'vitest'
import { fakeShellReads, mountApp } from '@/testing/app'
import { buildAlert, buildAlertsList } from '@/testing/fixtures/alerts'
import { buildDeviceSummary } from '@/testing/fixtures/devices'
import { fakeScreenImages } from '@/testing/images'
import { expectPageScreenshots } from '@/testing/screenshots'
import { freezeTime } from '@/testing/time'

const SEEN_AT = '2026-10-03T07:31:00.000Z'

const devices = [
  buildDeviceSummary({ id: 'kitchen', name: 'Kitchen', lastSeenAt: SEEN_AT, batteryPercent: 18 }),
  buildDeviceSummary({
    id: 'hallway',
    name: 'Hallway',
    lastSeenAt: SEEN_AT,
    batteryPercent: 76,
    sleep: { enabled: true, start: '23:00', end: '06:00', whileAsleep: 'fallback', inWindow: true, endsAt: '2026-10-04T04:00:00.000Z' },
    currentScreen: { kind: 'fallback', fallback: 'sleep', reason: 'asleep', screenId: null, imagePath: '/screens/sleep.png?v=1', servedAt: SEEN_AT },
  }),
  buildDeviceSummary({
    id: 'study',
    name: 'Study',
    lastSeenAt: '2026-10-03T07:29:00.000Z',
    batteryPercent: 54,
    currentScreen: { kind: 'screen', screenId: 'photo', name: 'Harbour photo', imagePath: '/screens/devices/study/photo.png?v=1', renderedAt: SEEN_AT, servedAt: SEEN_AT, paused: false, holding: false },
  }),
  buildDeviceSummary({
    id: 'cellar',
    name: 'Cellar',
    lastSeenAt: null,
    nextPollAt: null,
    batteryPercent: null,
    rssi: null,
    currentScreen: { kind: 'fallback', fallback: 'welcome', reason: 'neverPolled', screenId: null, imagePath: '/screens/welcome.png?v=1', servedAt: null },
  }),
]

describe('the Devices list', () => {
  it('with an Active Screen and the low-battery Alert firing, a Device asleep and one that never polled', async () => {
    freezeTime('2026-10-03T07:35:00.000Z')
    fakeScreenImages()
    fakeShellReads({ devices, alerts: buildAlertsList({ active: [buildAlert({ kind: 'device-low-battery', deviceId: 'kitchen' })] }) })
    const screen = await mountApp({ at: '/devices' })
    await expect.element(screen.getByRole('link', { name: '1 Alert firing' })).toBeVisible()
    await expect.element(screen.getByRole('img', { name: 'On Kitchen: Calendar' })).toBeVisible()
    await expect.element(screen.getByText('Has not called in yet')).toBeVisible()
    await expect.poll(() => [...document.images].every(image => image.complete)).toBe(true)

    await expectPageScreenshots('devices-list')
  })
})
