import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { api, apiUrl } from '@/testing/api/server'
import { fakeShellReads, mountApp } from '@/testing/app'
import { buildAlert, buildAlertsList } from '@/testing/fixtures/alerts'
import { buildDeviceDetail, buildDeviceSummary } from '@/testing/fixtures/devices'
import { buildSchedule, buildScreen } from '@/testing/fixtures/screens'
import { fakeScreenImages } from '@/testing/images'
import { expectPageScreenshots } from '@/testing/screenshots'
import { freezeTime } from '@/testing/time'

const imagePath = (id: string) => `/screens/devices/kitchen/${id}.png?v=1`

const screens = [
  buildScreen({ id: 'weather', name: 'Weather', order: 1, imagePath: imagePath('weather') }),
  buildScreen({ id: 'calendar', name: 'Calendar', order: 2, state: 'active', imagePath: imagePath('calendar'), schedule: buildSchedule() }),
  buildScreen({ id: 'photo', name: 'Harbour photo', order: 3, kind: 'file', plugin: null, state: 'upNext', imagePath: imagePath('photo') }),
  buildScreen({ id: 'trains', name: 'Train departures', order: 4, state: 'scheduleOff', imagePath: imagePath('trains'), schedule: buildSchedule({ enabled: false, startTime: '06:30', endTime: '08:30' }) }),
  buildScreen({ id: 'weekend', name: 'Weekend board', order: 5, kind: 'mashup', plugin: null, state: 'notToday', stateCause: 'weekday', imagePath: imagePath('weekend'), schedule: buildSchedule({ weekdays: [0], startTime: null, endTime: null }) }),
  buildScreen({ id: 'bins', name: 'Bin day', order: 6, state: 'skipping', renderSignal: 'skip', imagePath: null, renderedAt: null }),
]

const device = buildDeviceDetail({
  id: 'kitchen',
  name: 'Kitchen',
  batteryPercent: 18,
  screenCount: screens.length,
  sleep: { enabled: true, start: '23:00', end: '06:00', whileAsleep: 'fallback', inWindow: false, endsAt: null },
  sensors: [{ kind: 'temperature', value: 21.4, unit: '°C' }, { kind: 'humidity', value: 48, unit: '%' }],
  currentScreen: { kind: 'screen', screenId: 'calendar', name: 'Calendar', imagePath: imagePath('calendar'), renderedAt: '2026-10-03T07:31:00.000Z', servedAt: '2026-10-03T07:31:00.000Z', paused: false, holding: false },
})

describe('the Screens view of a Device', () => {
  it('with an Active Screen, a Screen opened and the low-battery Alert firing', async () => {
    freezeTime('2026-10-03T07:35:00.000Z')
    fakeScreenImages()
    fakeShellReads({
      devices: [buildDeviceSummary({ id: 'kitchen', name: 'Kitchen' })],
      alerts: buildAlertsList({ active: [buildAlert({ kind: 'device-low-battery', deviceId: 'kitchen' })] }),
    })
    api.use(
      http.get(apiUrl('devices/kitchen'), () => HttpResponse.json(device)),
      http.get(apiUrl('devices/kitchen/screens'), () => HttpResponse.json(screens)),
    )
    const screen = await mountApp({ at: '/devices/kitchen?screen=photo' })
    await expect.element(screen.getByRole('link', { name: '1 Alert firing' })).toBeVisible()
    await expect.element(screen.getByRole('img', { name: 'On Kitchen: Calendar' })).toBeVisible()
    await expect.element(screen.getByRole('img', { name: 'Harbour photo, as rendered for Kitchen' })).toBeVisible()
    await expect.poll(() => [...document.images].every(image => image.complete)).toBe(true)

    await expectPageScreenshots('device-screens')
  })
})
