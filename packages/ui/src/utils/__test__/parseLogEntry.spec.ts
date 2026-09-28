import { describe, expect, it } from 'vitest'
import { parseLogEntry } from '../parseLogEntry'

const currentEntry = {
  created_at: 1790619540,
  id: 4211,
  message: '[HTTPS] POST... failed, returned HTTP code unknown: 400 ...',
  source_line: 62,
  source_path: 'src/api-client/submit_log.cpp',
  wifi_signal: -63,
  wifi_status: 'connected',
  refresh_rate: 300,
  sleep_duration: 300123,
  firmware_version: '1.8.10',
  special_function: 'none',
  battery_voltage: 4.2,
  wake_reason: 'timer',
  free_heap_size: 180344,
  max_alloc_size: 110580,
  level: 'error',
  retry: 2,
}

const legacyEntry = {
  creation_timestamp: 1790619540,
  log_id: 4211,
  log_message: '[HTTPS] POST... failed, returned HTTP code unknown: 400 ...',
  log_codeline: 62,
  log_sourcefile: 'src/api-client/submit_log.cpp',
  device_status_stamp: {
    wifi_rssi_level: -63,
    wifi_status: 'connected',
    refresh_rate: 300,
    time_since_last_sleep_start: 300123,
    current_fw_version: '1.8.10',
    special_function: 'none',
    battery_voltage: 4.2,
    wakeup_reason: 'timer',
    free_heap_size: 180344,
    max_alloc_size: 110580,
  },
  additional_info: {
    filename_current: 'a.bin',
    filename_new: 'b.bin',
    retry_attempt: 2,
  },
}

describe('parseLogEntry', () => {
  it('maps a current-format entry and an old-format entry to the same display model shape', () => {
    const current = parseLogEntry(JSON.stringify(currentEntry))
    const legacy = parseLogEntry(JSON.stringify(legacyEntry))

    expect(current.message).toBe(legacy.message)
    expect(current.sourceFile).toBe(legacy.sourceFile)
    expect(current.sourceLine).toBe(legacy.sourceLine)
    expect(current.status).toEqual(legacy.status)
  })

  it('reads device status fields off a current-format entry', () => {
    const result = parseLogEntry(JSON.stringify(currentEntry))
    expect(result.status).toEqual({
      wifiRssi: -63,
      wifiStatus: 'connected',
      batteryVoltage: 4.2,
      firmwareVersion: '1.8.10',
      freeHeapSize: 180344,
      wakeReason: 'timer',
    })
  })

  it('reads device status fields off an old-format entry', () => {
    const result = parseLogEntry(JSON.stringify(legacyEntry))
    expect(result.status).toEqual({
      wifiRssi: -63,
      wifiStatus: 'connected',
      batteryVoltage: 4.2,
      firmwareVersion: '1.8.10',
      freeHeapSize: 180344,
      wakeReason: 'timer',
    })
  })

  it('collects the remaining current-format fields as extras', () => {
    const result = parseLogEntry(JSON.stringify(currentEntry))
    expect(result.extras).toEqual({
      refresh_rate: 300,
      sleep_duration: 300123,
      special_function: 'none',
      max_alloc_size: 110580,
      retry: 2,
    })
  })

  it('does not include retry in extras when absent', () => {
    const { retry, ...withoutRetry } = currentEntry
    const result = parseLogEntry(JSON.stringify(withoutRetry))
    expect(result.extras.retry).toBeUndefined()
  })

  it('reads additional_info off an old-format entry as extras', () => {
    const result = parseLogEntry(JSON.stringify(legacyEntry))
    expect(result.extras).toEqual({
      filename_current: 'a.bin',
      filename_new: 'b.bin',
      retry_attempt: 2,
    })
  })

  it.each([
    ['fatal', 'error'],
    ['error', 'error'],
    ['warn', 'warning'],
    ['info', 'info'],
    ['debug', 'default'],
  ])('maps level %s to severity %s', (level, severity) => {
    const result = parseLogEntry(JSON.stringify({ ...currentEntry, level }))
    expect(result.severity).toBe(severity)
  })

  it('falls back to the keyword heuristic when level is absent, as old entries have no level', () => {
    expect(parseLogEntry(JSON.stringify({ log_message: 'A critical error occurred' })).severity).toBe('error')
    expect(parseLogEntry(JSON.stringify({ log_message: 'This is just a warning' })).severity).toBe('warning')
    expect(parseLogEntry(JSON.stringify({ log_message: 'Info: startup complete' })).severity).toBe('info')
    expect(parseLogEntry(JSON.stringify({ log_message: 'nothing special happened' })).severity).toBe('default')
  })

  it('falls back to the raw text as the message when JSON parsing fails', () => {
    const result = parseLogEntry('not json')
    expect(result.message).toBe('not json')
    expect(result.status).toBeUndefined()
    expect(result.extras).toEqual({})
  })
})
