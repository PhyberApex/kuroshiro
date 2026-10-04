import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { api, apiUrl } from '@/testing/api/server'
import { fakeShellReads, mountApp } from '@/testing/app'
import { buildAlert, buildAlertsList } from '@/testing/fixtures/alerts'
import { buildDeviceDetail, buildDeviceSummary } from '@/testing/fixtures/devices'
import { buildPluginSummary } from '@/testing/fixtures/plugins'
import { buildSchedule, buildScreen } from '@/testing/fixtures/screens'
import { fakeScreenImages } from '@/testing/images'
import { expectPageScreenshots } from '@/testing/screenshots'
import { freezeTime } from '@/testing/time'

const imagePath = (id: string) => `/screens/devices/kitchen/${id}.png?v=1`

const screens = [
  buildScreen({ id: 'weather', deviceId: 'kitchen', name: 'Weather', order: 1, imagePath: imagePath('weather'), plugin: { id: 'weather', name: 'Weather', kind: 'Webhook', requiredFieldEmpty: true, fetchAlertFiring: true } }),
  buildScreen({ id: 'calendar', name: 'Calendar', order: 2, state: 'active', imagePath: imagePath('calendar'), schedule: buildSchedule() }),
  buildScreen({ id: 'photo', deviceId: 'kitchen', name: 'Harbour photo', order: 3, kind: 'file', plugin: null, state: 'upNext', imagePath: imagePath('photo'), file: { originalName: 'harbour.png', width: 1600, height: 960, bytes: 421_888, uploadedAt: '2026-09-12T10:00:00.000Z' } }),
  buildScreen({ id: 'trains', deviceId: 'kitchen', name: 'Train departures', order: 4, kind: 'external', plugin: null, state: 'scheduleOff', imagePath: imagePath('trains'), external: { url: 'https://departures.example/central-station.png', fetchManual: true }, schedule: buildSchedule({ enabled: false, startTime: '06:30', endTime: '08:30' }) }),
  buildScreen({ id: 'weekend', name: 'Weekend board', order: 5, kind: 'mashup', plugin: null, state: 'notToday', stateCause: 'weekday', imagePath: imagePath('weekend'), schedule: buildSchedule({ weekdays: [0], startTime: null, endTime: null }), mashup: {
    layout: '1Lx2R',
    slots: [
      { position: 'left', size: 'half_vertical', pluginId: 'weather', pluginName: 'Weather' },
      { position: 'top-right', size: 'quadrant', pluginId: 'calendar', pluginName: 'Calendar' },
      { position: 'bottom-right', size: 'quadrant', pluginId: 'bins', pluginName: 'Bin day' },
    ],
  } }),
  buildScreen({ id: 'bins', name: 'Bin day', order: 6, state: 'skipping', renderSignal: 'skip', imagePath: null, renderedAt: null }),
  buildScreen({ id: 'notes', deviceId: 'kitchen', name: 'Notes', order: 7, kind: 'html', plugin: null, imagePath: imagePath('notes'), html: '<h1>Notes</h1>' }),
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

const plugins = Object.entries({ weather: 'Weather', calendar: 'Calendar', bins: 'Bin day', trains: 'Train times' }).map(([id, name]) => buildPluginSummary({ id, name }))

async function mountWithOpened(screenId: string, name: string) {
  freezeTime('2026-10-03T07:35:00.000Z')
  fakeScreenImages()
  fakeShellReads({
    devices: [buildDeviceSummary({ id: 'kitchen', name: 'Kitchen' })],
    alerts: buildAlertsList({ active: [buildAlert({ kind: 'device-low-battery', deviceId: 'kitchen' })] }),
  })
  api.use(
    http.get(apiUrl('devices/kitchen'), () => HttpResponse.json(device)),
    http.get(apiUrl('devices/kitchen/screens'), () => HttpResponse.json(screens)),
    http.get(apiUrl('plugins'), () => HttpResponse.json(plugins)),
  )
  const screen = await mountApp({ at: `/devices/kitchen?screen=${screenId}` })
  await expect.element(screen.getByRole('link', { name: '1 Alert firing' })).toBeVisible()
  await expect.element(screen.getByRole('img', { name: 'On Kitchen: Calendar' })).toBeVisible()
  await expect.element(screen.getByRole('img', { name: `${name}, as rendered for Kitchen` })).toBeVisible()
  await expect.poll(() => [...document.images].every(image => image.complete)).toBe(true)
}

describe('the Screens view of a Device', () => {
  it('with an Active Screen, a File Screen opened and the low-battery Alert firing', async () => {
    await mountWithOpened('photo', 'Harbour photo')

    await expectPageScreenshots('device-screens')
  })

  it.for([
    { id: 'weather', name: 'Weather', kind: 'plugin' },
    { id: 'weekend', name: 'Weekend board', kind: 'mashup' },
    { id: 'trains', name: 'Train departures', kind: 'external-link' },
    { id: 'notes', name: 'Notes', kind: 'html' },
  ])('with a Screen of the kind $kind opened', async ({ id, name, kind }) => {
    await mountWithOpened(id, name)

    await expectPageScreenshots(`device-screens-${kind}`)
  })
})
