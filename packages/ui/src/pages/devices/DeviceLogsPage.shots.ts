import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { api, apiUrl } from '@/testing/api/server'
import { mountApp } from '@/testing/app'
import { buildDeviceLogEntry, buildDeviceLogPage } from '@/testing/fixtures/devices'
import { expectPageScreenshots } from '@/testing/screenshots'
import { fakeKitchenLog } from './__test__/deviceLogHarness'

const poll = (id: string, at: string, screen: string) => buildDeviceLogEntry({ id, at, message: `display poll, served ${screen}` })

const entries = [
  poll('poll-1', '2026-10-03T07:31:10.000Z', 'Calendar (Order 2)'),
  poll('poll-2', '2026-10-03T07:16:08.000Z', 'Weather (Order 1)'),
  buildDeviceLogEntry({ id: 'battery', at: '2026-10-03T07:01:07.000Z', level: 'warning', message: 'battery 3.42 V, below the low-battery threshold', source: { file: 'src/battery.cpp', line: 88 } }),
  buildDeviceLogEntry({ id: 'woke', at: '2026-10-03T06:00:02.000Z', message: 'woke from Sleep Mode' }),
  buildDeviceLogEntry({ id: 'sleep', at: '2026-10-02T23:00:01.000Z', message: 'Sleep Mode until 06:00, refresh_rate 25200 s' }),
  buildDeviceLogEntry({
    id: 'download',
    at: '2026-10-02T21:14:40.000Z',
    level: 'error',
    message: 'image download failed, HTTP 502, retrying at the next poll',
    source: { file: 'src/display.cpp', line: 171 },
    status: { wifiRssi: -74, wifiStatus: 'connected', batteryVoltage: 3.49, freeHeapSize: 141000, wakeReason: 'timer' },
    firmwareVersion: '1.6.8',
    extras: { retry: 1 },
  }),
  poll('poll-3', '2026-10-02T20:59:38.000Z', 'Harbour photo (Order 3)'),
  buildDeviceLogEntry({ id: 'wifi', at: '2026-10-02T20:44:37.000Z', level: 'warning', message: 'wifi reconnect took 9 s', source: { file: 'src/wifi.cpp', line: 204 } }),
  buildDeviceLogEntry({ id: 'heap', at: '2026-10-01T20:29:35.000Z', level: 'debug', message: 'heap after render 141 kB' }),
]

describe('the Logs of a Device', () => {
  it('with an entry opened, older entries to load and new ones arrived', async () => {
    fakeKitchenLog()
    api.use(http.get(apiUrl('devices/kitchen/logs'), ({ request }) => HttpResponse.json(new URL(request.url).searchParams.has('after')
      ? buildDeviceLogPage({ entries: [], total: 135, matching: 3 })
      : buildDeviceLogPage({ entries, total: 132, matching: 132, nextCursor: 'older' }))))
    const screen = await mountApp({ at: '/devices/kitchen/logs' })
    await expect.element(screen.getByText('Showing 9 of 132, newest first')).toBeVisible()
    await expect.element(screen.getByText('Entries older than 30 days', { exact: false })).toBeVisible()

    // Opened and asked for without the pointer, which the shot files share.
    screen.getByRole('button', { name: /image download failed/ }).element().dispatchEvent(new MouseEvent('click', { bubbles: true }))
    window.dispatchEvent(new Event('focus'))
    await expect.element(screen.getByText('src/display.cpp:171')).toBeVisible()
    await expect.element(screen.getByRole('button', { name: '3 new entries' })).toBeVisible()

    await expectPageScreenshots('device-logs')
  })
})
