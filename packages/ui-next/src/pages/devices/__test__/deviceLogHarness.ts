import type { DeviceLogEntry, DeviceLogPage } from 'kuroshiro-shared'
import { http, HttpResponse } from 'msw'
import { api, apiUrl } from '@/testing/api/server'
import { fakeShellReads } from '@/testing/app'
import { buildDeviceDetail, buildDeviceLogEntry, buildDeviceSummary } from '@/testing/fixtures/devices'
import { buildInstanceSettings } from '@/testing/fixtures/instance'
import { freezeTime } from '@/testing/time'
import { holdTabVisible } from '@/testing/visibility'

const NOW = '2026-10-03T07:35:00.000Z'

export const ENTRIES: DeviceLogEntry[] = [
  buildDeviceLogEntry({ id: 'poll-calendar', at: '2026-10-03T07:31:10.000Z', message: 'display poll, served Calendar (Order 2)' }),
  buildDeviceLogEntry({ id: 'battery-low', at: '2026-10-03T07:12:07.000Z', level: 'warning', message: 'battery 3.42 V, below the low-battery threshold', source: { file: 'src/battery.cpp', line: 88 } }),
  buildDeviceLogEntry({
    id: 'download-failed',
    at: '2026-10-02T07:14:40.000Z',
    level: 'error',
    message: 'image download failed, HTTP 502, retrying at the next poll',
    source: { file: 'src/display.cpp', line: 171 },
    status: { wifiRssi: -74, wifiStatus: 'connected', batteryVoltage: 3.49, freeHeapSize: 141000, wakeReason: 'timer' },
    firmwareVersion: '1.6.8',
    extras: { retry: 1, special_function: 'none' },
  }),
  buildDeviceLogEntry({ id: 'wifi-slow', at: '2026-10-02T07:09:37.000Z', level: 'warning', message: 'WiFi reconnect took 9 s', source: { file: 'src/wifi.cpp', line: 204 } }),
  buildDeviceLogEntry({ id: 'heap', at: '2026-09-30T07:29:35.000Z', level: 'debug', message: 'heap after render 141 kB', source: null, status: null, firmwareVersion: null }),
  buildDeviceLogEntry({ id: 'wifi-connected', at: '2026-09-30T07:20:00.000Z', message: 'wifi connected' }),
]

/** `count` quiet polls, a minute apart, the newest first and just before `newestAt`. */
export function quietPolls(count: number, newestAt = '2026-10-01T12:00:00.000Z', prefix = 'poll'): DeviceLogEntry[] {
  const newest = new Date(newestAt).getTime()
  return Array.from({ length: count }, (_, index) => buildDeviceLogEntry({
    id: `${prefix}-${index + 1}`,
    at: new Date(newest - index * 60_000).toISOString(),
    message: `display poll ${prefix} ${index + 1}`,
  }))
}

const cursorOf = (entry: DeviceLogEntry) => `cursor-${entry.id}`
const isProblem = (entry: DeviceLogEntry) => entry.level === 'error' || entry.level === 'warning'

export interface FakedLog {
  /** The Device Log on the server, newest first. A test changes it and the next request sees it. */
  entries: DeviceLogEntry[]
  /** The query of every read of the Device Log, in order. */
  reads: Record<string, string>[]
  /** How often the Device Log was cleared. */
  cleared: number
  /** While set, every read of the Device Log fails with it. */
  failing?: Response
}

function pageOf(log: DeviceLogEntry[], query: URLSearchParams): DeviceLogPage {
  const position = (cursor: string | null) => log.findIndex(entry => cursorOf(entry) === cursor)
  const sought = query.get('q')?.toLowerCase()
  const limit = Number(query.get('limit') ?? 50)
  const after = query.get('after')
  const before = query.get('before')

  const matching = log
    .filter(entry => query.get('level') !== 'problems' || isProblem(entry))
    .filter(entry => !sought || entry.message.toLowerCase().includes(sought))
    .filter(entry => !after || log.indexOf(entry) < position(after))
  const older = matching.filter(entry => !before || log.indexOf(entry) > position(before))
  const entries = older.slice(0, limit)

  return {
    entries,
    total: log.length,
    matching: matching.length,
    nextCursor: older.length > limit && entries.length > 0 ? cursorOf(entries[entries.length - 1]) : null,
    newestCursor: log[0] ? cursorOf(log[0]) : null,
  }
}

/** Fakes what the Logs page of Kitchen reads, with a Device Log that pages, filters and searches as the server does. */
export function fakeKitchenLog({ entries = ENTRIES, deviceLogRetentionDays = 30 } = {}): FakedLog {
  const faked: FakedLog = { entries, reads: [], cleared: 0 }
  freezeTime(NOW)
  holdTabVisible()
  fakeShellReads({ devices: [buildDeviceSummary({ id: 'kitchen', name: 'Kitchen' })] })
  api.use(
    http.get(apiUrl('devices/kitchen'), () => HttpResponse.json(buildDeviceDetail({ id: 'kitchen', name: 'Kitchen' }))),
    http.get(apiUrl('settings'), () => HttpResponse.json(buildInstanceSettings({
      deviceLogRetentionDays: { override: null, value: deviceLogRetentionDays, fallbackSource: 'default', fallbackValue: 30 },
    }))),
    http.get(apiUrl('devices/kitchen/logs'), ({ request }) => {
      const query = new URL(request.url).searchParams
      faked.reads.push(Object.fromEntries(query))
      return faked.failing?.clone() ?? HttpResponse.json(pageOf(faked.entries, query))
    }),
    http.delete(apiUrl('devices/kitchen/logs'), () => {
      faked.cleared += 1
      faked.entries = []
      return new HttpResponse(null, { status: 204 })
    }),
  )
  return faked
}
