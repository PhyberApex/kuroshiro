import { describe, expect, it } from 'vitest'
import { makeLogEntry } from '../../test/fixtures.js'
import { toDeviceLogEntry } from '../device-log.mapper.js'

describe('toDeviceLogEntry', () => {
  it('answers the stored level and message with what the firmware\'s JSON carries beside them', () => {
    const entry = makeLogEntry({
      id: 'entry-1',
      date: new Date('2026-09-30T21:14:40.000Z'),
      level: 'error',
      message: 'image download failed, HTTP 502',
      entry: JSON.stringify({
        id: 4211,
        created_at: 1790802880,
        message: 'image download failed, HTTP 502',
        level: 'error',
        source_path: 'src/display.cpp',
        source_line: 171,
        wifi_signal: -61,
        wifi_status: 'connected',
        battery_voltage: 3.42,
        firmware_version: '1.6.8',
        free_heap_size: 141000,
        wake_reason: 'timer',
        retry: 1,
      }),
    })

    expect(JSON.parse(JSON.stringify(toDeviceLogEntry(entry)))).toEqual({
      id: 'entry-1',
      at: '2026-09-30T21:14:40.000Z',
      level: 'error',
      message: 'image download failed, HTTP 502',
      source: { file: 'src/display.cpp', line: 171 },
      status: { wifiRssi: -61, wifiStatus: 'connected', batteryVoltage: 3.42, freeHeapSize: 141000, wakeReason: 'timer' },
      firmwareVersion: '1.6.8',
      extras: { retry: 1 },
    })
  })

  it('spells out every key of an entry that carries nothing but its message', () => {
    const entry = makeLogEntry({ id: 'entry-2', date: new Date('2026-09-30T09:00:00.000Z'), level: 'info', message: 'boot', entry: '{"id":1,"message":"boot"}' })

    expect(toDeviceLogEntry(entry)).toEqual({
      id: 'entry-2',
      at: '2026-09-30T09:00:00.000Z',
      level: 'info',
      message: 'boot',
      source: null,
      status: null,
      firmwareVersion: null,
      extras: {},
    })
  })
})
