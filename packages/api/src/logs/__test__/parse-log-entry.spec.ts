import { describe, expect, it } from 'vitest'
import { parseLogEntry, parseStoredLogEntry } from '../parse-log-entry.js'

describe('parsing a Device Log entry', () => {
  describe('the current firmware format', () => {
    const entry = {
      id: 4211,
      created_at: 1790619540,
      message: '[HTTPS] POST... failed, error: connection refused',
      level: 'error',
      source_path: 'src/bl.cpp',
      source_line: 597,
      wifi_signal: -61,
      wifi_status: 'connected',
      battery_voltage: 3.42,
      firmware_version: '1.6.8',
      free_heap_size: 141000,
      wake_reason: 'timer',
      refresh_rate: 900,
      retry: 2,
    }

    it('reads the message, the level, the source, the Device status, the Firmware and the further fields', () => {
      expect(parseLogEntry(entry)).toEqual({
        level: 'error',
        message: '[HTTPS] POST... failed, error: connection refused',
        source: { file: 'src/bl.cpp', line: 597 },
        status: { wifiRssi: -61, wifiStatus: 'connected', batteryVoltage: 3.42, freeHeapSize: 141000, wakeReason: 'timer' },
        firmwareVersion: '1.6.8',
        extras: { refresh_rate: 900, retry: 2 },
      })
    })

    it.each([
      ['fatal', 'error'],
      ['error', 'error'],
      ['warn', 'warning'],
      ['info', 'info'],
      ['debug', 'debug'],
    ])('reads the firmware level %s as %s', (level, expected) => {
      expect(parseLogEntry({ id: 1, message: 'display poll', level }).level).toBe(expected)
    })

    it('falls back to the keywords of the message for a level it does not know', () => {
      expect(parseLogEntry({ id: 1, message: 'wifi warning: weak signal', level: 'verbose' }).level).toBe('warning')
      expect(parseLogEntry({ id: 1, message: 'display poll' }).level).toBe('info')
    })

    it('answers no source and no Device status for an entry that carries neither', () => {
      expect(parseLogEntry({ id: 1, message: 'boot', level: 'info' })).toEqual({
        level: 'info',
        message: 'boot',
        source: null,
        status: null,
        firmwareVersion: null,
        extras: {},
      })
    })
  })

  describe('the legacy firmware format', () => {
    const entry = {
      log_id: 17,
      creation_timestamp: 1790619540,
      log_message: 'Failed to resolve hostname',
      log_sourcefile: 'src/bl.cpp',
      log_codeline: 1203,
      device_status_stamp: {
        wifi_rssi_level: -74,
        wifi_status: 'disconnected',
        battery_voltage: 3.9,
        current_fw_version: '1.5.2',
        free_heap_size: 98000,
        wakeup_reason: 'button',
        refresh_rate: 1800,
      },
      additional_info: { retry_attempt: 3 },
    }

    it('reads its own field names, and takes the level from the keywords of the message', () => {
      expect(parseLogEntry(entry)).toEqual({
        level: 'error',
        message: 'Failed to resolve hostname',
        source: { file: 'src/bl.cpp', line: 1203 },
        status: { wifiRssi: -74, wifiStatus: 'disconnected', batteryVoltage: 3.9, freeHeapSize: 98000, wakeReason: 'button' },
        firmwareVersion: '1.5.2',
        extras: { refresh_rate: 1800, retry_attempt: 3 },
      })
    })

    it.each([
      ['an error occurred', 'error'],
      ['connect FAILED', 'error'],
      ['warning: battery low', 'warning'],
      ['display poll', 'info'],
    ])('reads "%s" as %s', (log_message, expected) => {
      expect(parseLogEntry({ log_id: 1, log_message }).level).toBe(expected)
    })
  })

  describe('a stored entry', () => {
    it('is parsed from the JSON it was stored as', () => {
      expect(parseStoredLogEntry(JSON.stringify({ id: 1, message: 'boot', level: 'debug' }))).toMatchObject({ level: 'debug', message: 'boot' })
    })

    it('is its own message when it is no JSON object', () => {
      expect(parseStoredLogEntry('wifi connect failed')).toEqual({ level: 'error', message: 'wifi connect failed', source: null, status: null, firmwareVersion: null, extras: {} })
      expect(parseStoredLogEntry('42')).toMatchObject({ level: 'info', message: '42' })
    })
  })
})
