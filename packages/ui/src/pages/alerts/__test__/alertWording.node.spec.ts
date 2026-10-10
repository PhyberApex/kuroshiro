import type { AlertSummary } from 'kuroshiro-shared'
import { describe, expect, it } from 'vitest'
import { alertSubject, alertWhy, duration, firedFor, sinceWhen } from '../alertWording'

/** Saturday 3 October 2026, 09:35, on the clock of whoever runs the spec. */
const NOW = new Date(2026, 9, 3, 9, 35)
const at = (day: number, hour: number, minute: number) => new Date(2026, 9, day, hour, minute).toISOString()

function alert(overrides: Partial<AlertSummary>): AlertSummary {
  return { id: 'alert', kind: 'device-low-battery', deviceId: 'hallway', deviceName: 'Hallway', openedAt: at(3, 8, 10), resolvedAt: null, details: { percent: 14 }, ...overrides }
}

const FETCH = { kind: 'data-source-fetch-failing', deviceId: undefined, deviceName: undefined, pluginId: 'trains', pluginName: 'Train departures', dataSourceId: 'source', dataSourceName: 'departures' } as const
const TOLD = { now: NOW, lowBatteryPercent: 20 }

const words = (sentence: { text: string }[]) => sentence.map(part => part.text).join('')

describe('why an Alert fires', () => {
  it('names the battery\'s percent and the threshold in force', () => {
    expect(words(alertWhy(alert({}), TOLD))).toBe('Battery at 14 %, below 20 %')
  })

  it('says it is not yet back at the resolve point once the battery is at or above the threshold', () => {
    expect(words(alertWhy(alert({ details: { percent: 22 } }), TOLD))).toBe('Battery at 22 %, not yet back at 25 %')
    expect(words(alertWhy(alert({ details: { percent: 20 } }), TOLD))).toBe('Battery at 20 %, not yet back at 25 %')
  })

  it('says when an offline Device was last seen and how long ago that is', () => {
    const offline = alert({ kind: 'device-offline', details: { lastSeen: at(3, 6, 31) } })

    expect(words(alertWhy(offline, TOLD))).toBe('Last seen 06:31, 3 h 4 min ago')
  })

  it('counts the failed fetches and gives the last answer in mono', () => {
    const why = alertWhy(alert({ ...FETCH, details: { streak: 5, lastError: '503 Service Unavailable' } }), TOLD)

    expect(words(why)).toBe('5 fetches failed in a row. The last answer: 503 Service Unavailable')
    expect(why.at(-1)).toEqual({ text: '503 Service Unavailable', mono: true })
  })

  it('leaves the last answer out when the server kept none', () => {
    expect(words(alertWhy(alert({ ...FETCH, details: { streak: 3, lastError: null } }), TOLD))).toBe('3 fetches failed in a row.')
  })
})

describe('why a resolved Alert fired', () => {
  const resolvedAt = at(3, 9, 0)

  it('keeps the battery\'s percent and drops the threshold, which may have changed since', () => {
    expect(words(alertWhy(alert({ resolvedAt, details: { percent: 17 } }), TOLD))).toBe('Battery at 17 %')
  })

  it('says how long the Device had not polled when the Alert fired', () => {
    const offline = alert({ kind: 'device-offline', openedAt: at(3, 2, 10), resolvedAt, details: { lastSeen: at(3, 1, 5) } })

    expect(words(alertWhy(offline, TOLD))).toBe('No poll for 1 h 5 min')
  })

  it('counts the failed fetches with the last answer after a colon', () => {
    const fetch = alert({ ...FETCH, resolvedAt, details: { streak: 3, lastError: 'getaddrinfo ENOTFOUND api.open-meteo.com' } })

    expect(words(alertWhy(fetch, TOLD))).toBe('3 fetches failed in a row: getaddrinfo ENOTFOUND api.open-meteo.com')
    expect(words(alertWhy({ ...fetch, details: { streak: 1, lastError: null } }, TOLD))).toBe('1 fetch failed in a row')
  })

  it('says nothing for an Alert whose details are not a cause of its kind', () => {
    expect(alertWhy(alert({ resolvedAt, details: null }), TOLD)).toEqual([])
    expect(alertWhy(alert({ ...FETCH, resolvedAt, details: { streak: 0, lastError: null } }), TOLD)).toEqual([])
    expect(alertWhy(alert({ kind: 'device-offline', openedAt: at(3, 2, 10), resolvedAt, details: { lastSeen: at(3, 8, 55) } }), TOLD)).toEqual([])
  })
})

describe('an Alert\'s subject', () => {
  it('is its Device, opening the Screens view', () => {
    expect(alertSubject(alert({}))).toEqual({ name: 'Hallway', dataSource: null, to: '/devices/hallway' })
  })

  it('is its Plugin and Data Source, opening the Plugin page at that Data Source', () => {
    expect(alertSubject(alert({ ...FETCH, dataSourceName: 'next departures' }))).toEqual({ name: 'Train departures', dataSource: 'next departures', to: '/plugins/trains?source=next%20departures' })
  })
})

describe('when an Alert fired', () => {
  it('is the time alone today, "yesterday" the day before, the weekday within a week and the date before that', () => {
    expect(sinceWhen(at(3, 8, 10), NOW)).toBe('since 08:10')
    expect(sinceWhen(at(2, 21, 35), NOW)).toBe('since yesterday, 21:35')
    expect(sinceWhen(at(0, 2, 10), NOW)).toBe('since Wednesday 02:10')
    expect(sinceWhen(new Date(2026, 7, 20, 7, 31).toISOString(), NOW)).toBe('since 20 Aug 2026, 07:31')
  })

  it('reads with how long it lasted once resolved', () => {
    expect(firedFor(alert({ openedAt: at(3, 8, 10), resolvedAt: at(3, 8, 55) }), NOW)).toBe('Today 08:10, for 45 min')
    expect(firedFor(alert({ openedAt: at(2, 21, 35), resolvedAt: at(3, 3, 35) }), NOW)).toBe('Yesterday 21:35, for 6 h')
    expect(firedFor(alert({ openedAt: at(0, 2, 10), resolvedAt: at(0, 3, 40) }), NOW)).toBe('Wednesday 02:10, for 1 h 30 min')
  })
})

describe('a duration', () => {
  it('is worded in its two largest units, leaving out one that is zero', () => {
    const MINUTE = 60_000
    expect(duration(20_000)).toBe('under a minute')
    expect(duration(45 * MINUTE)).toBe('45 min')
    expect(duration(65 * MINUTE)).toBe('1 h 5 min')
    expect(duration(6 * 60 * MINUTE)).toBe('6 h')
    expect(duration(27 * 60 * MINUTE)).toBe('1 day 3 h')
    expect(duration(48 * 60 * MINUTE)).toBe('2 days')
  })
})
