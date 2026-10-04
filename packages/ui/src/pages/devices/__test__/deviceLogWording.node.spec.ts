import { describe, expect, it } from 'vitest'
import { buildDeviceLogEntry } from '@/testing/fixtures/devices'
import { countLine, dayHeading, entryFacts, logTime, markedParts, newEntriesLabel, noMatchSentence, retentionSentence } from '../deviceLogWording'

const NOW = new Date(2026, 9, 1, 7, 46)

describe('the day heading of a Device Log', () => {
  it.each([
    [new Date(2026, 9, 1, 0, 0, 1), 'Today'],
    [new Date(2026, 8, 30, 23, 59, 59), 'Yesterday, Wednesday 30 September'],
    [new Date(2026, 8, 29, 12, 0), 'Tuesday 29 September'],
    [new Date(2025, 11, 31, 12, 0), 'Wednesday 31 December 2025'],
  ])('names %s as "%s"', (at, heading) => {
    expect(dayHeading(at, NOW)).toBe(heading)
  })
})

it('gives an entry\'s time to the second', () => {
  expect(logTime(new Date(2026, 9, 1, 7, 2, 9))).toBe('07:02:09')
})

describe('the line under the bar', () => {
  it('counts the entries shown against the whole Device Log', () => {
    expect(countLine({ shown: 50, total: 132, matching: 132, filtered: false })).toBe('Showing 50 of 132, newest first')
  })

  it('counts against what matches under a filter or a search', () => {
    expect(countLine({ shown: 4, total: 132, matching: 4, filtered: true })).toBe('Showing 4 of 4 that match, newest first')
  })

  it('says nothing while nothing is shown', () => {
    expect(countLine({ shown: 0, total: 132, matching: 0, filtered: true })).toBe('')
  })

  it.each([[1, '1 new entry'], [3, '3 new entries']])('words %i arrived as "%s"', (count, label) => {
    expect(newEntriesLabel(count)).toBe(label)
  })
})

describe('the nothing-matches sentence', () => {
  it.each([
    [{ q: 'wifi', level: 'problems' as const }, 'Nothing in Kitchen\'s Device Log matches “wifi” among warnings and errors.'],
    [{ q: 'wifi', level: 'all' as const }, 'Nothing in Kitchen\'s Device Log matches “wifi”.'],
    [{ q: '', level: 'problems' as const }, 'Nothing in Kitchen\'s Device Log is a warning or an error.'],
  ])('words %o', (filter, said) => {
    expect(noMatchSentence('Kitchen', filter)).toBe(said)
  })
})

describe('the matched text of a message', () => {
  it('marks every occurrence, whatever its case', () => {
    expect(markedParts('WiFi lost, wifi reconnect', 'wifi')).toEqual([
      { text: 'WiFi', marked: true },
      { text: ' lost, ', marked: false },
      { text: 'wifi', marked: true },
      { text: ' reconnect', marked: false },
    ])
  })

  it('reads what is searched for as text, not as a pattern', () => {
    expect(markedParts('took 9 s (retry)', '(re')).toEqual([
      { text: 'took 9 s ', marked: false },
      { text: '(re', marked: true },
      { text: 'try)', marked: false },
    ])
  })

  it('marks nothing without a search', () => {
    expect(markedParts('display poll', '')).toEqual([{ text: 'display poll', marked: false }])
  })
})

describe('what an opened entry carries', () => {
  it('words the source, the Device status, the Firmware and every further field by its own name', () => {
    const entry = buildDeviceLogEntry({
      source: { file: 'src/display.cpp', line: 171 },
      status: { wifiRssi: -61, wifiStatus: 'connected', batteryVoltage: 3.42, freeHeapSize: 141000, wakeReason: 'timer' },
      firmwareVersion: '1.6.8',
      extras: { retry: 1, special_function: 'none', detail: { code: 502 } },
    })

    expect(entryFacts(entry)).toEqual([
      { label: 'Source', value: 'src/display.cpp:171' },
      { label: 'Device status', value: 'battery 3.42 V · rssi −61 dBm · Wi-Fi connected · free heap 141 kB · wake reason timer' },
      { label: 'Firmware', value: '1.6.8' },
      { label: 'retry', value: '1' },
      { label: 'special_function', value: 'none' },
      { label: 'detail', value: '{"code":502}' },
    ])
  })

  it('leaves out what the entry does not carry', () => {
    const entry = buildDeviceLogEntry({
      source: { file: 'src/wifi.cpp', line: null },
      status: { wifiRssi: -74, wifiStatus: null, batteryVoltage: null, freeHeapSize: null, wakeReason: null },
      firmwareVersion: null,
      extras: {},
    })

    expect(entryFacts(entry)).toEqual([
      { label: 'Source', value: 'src/wifi.cpp' },
      { label: 'Device status', value: 'rssi −74 dBm' },
    ])
    expect(entryFacts(buildDeviceLogEntry({ source: null, status: null, firmwareVersion: null, extras: {} }))).toEqual([])
  })
})

describe('the Retention sentence', () => {
  const words = (days: number) => retentionSentence(days).map(part => part.text).join('')

  it('names the Device Log\'s Retention age and links to where it is set', () => {
    expect(words(30)).toBe('Entries older than 30 days are removed by Retention.')
    expect(words(1)).toBe('Entries older than 1 day are removed by Retention.')
    expect(retentionSentence(30).find(part => part.to)).toEqual({ text: 'Retention', to: '/instance/settings#retention' })
  })

  it('says that entries stay when Retention does not prune the Device Log', () => {
    expect(words(0)).toBe('Entries stay until the Device Log is cleared: Retention does not remove them.')
  })
})
