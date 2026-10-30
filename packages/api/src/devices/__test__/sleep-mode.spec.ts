import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isDeviceAsleep, lastSleepEnd, MIN_SLEEP_REFRESH_RATE, nextSleepEnd, secondsUntilSleepEnd } from '../sleep-mode.js'

function time(hh: number, mm: number, ss = 0): Date {
  return new Date(2026, 0, 1, hh, mm, ss)
}

describe('isDeviceAsleep', () => {
  it('is never asleep when sleep mode is disabled', () => {
    expect(isDeviceAsleep({ sleepModeEnabled: false, sleepStartTime: 0, sleepEndTime: 3600 }, time(0, 30))).toBe(false)
  })

  it('is never asleep when the window is not configured', () => {
    expect(isDeviceAsleep({ sleepModeEnabled: true, sleepStartTime: null, sleepEndTime: null }, time(0, 30))).toBe(false)
  })

  it('is asleep inside a same-day window', () => {
    const device = { sleepModeEnabled: true, sleepStartTime: 7 * 3600, sleepEndTime: 9 * 3600 }
    expect(isDeviceAsleep(device, time(8, 0))).toBe(true)
    expect(isDeviceAsleep(device, time(6, 59))).toBe(false)
    expect(isDeviceAsleep(device, time(9, 0))).toBe(false)
  })

  it('is asleep on both sides of a window that crosses midnight', () => {
    const device = { sleepModeEnabled: true, sleepStartTime: 22 * 3600, sleepEndTime: 6 * 3600 }
    expect(isDeviceAsleep(device, time(23, 0))).toBe(true)
    expect(isDeviceAsleep(device, time(1, 0))).toBe(true)
    expect(isDeviceAsleep(device, time(6, 0))).toBe(false)
    expect(isDeviceAsleep(device, time(21, 59))).toBe(false)
    expect(isDeviceAsleep(device, time(12, 0))).toBe(false)
  })
})

describe('secondsUntilSleepEnd', () => {
  it('returns seconds remaining until sleepEndTime on the same day', () => {
    expect(secondsUntilSleepEnd(9 * 3600, time(8, 0))).toBe(3600)
  })

  it('wraps past midnight when the window crosses it', () => {
    expect(secondsUntilSleepEnd(6 * 3600, time(23, 0))).toBe(7 * 3600)
  })

  it('rounds a part second up so the Device never wakes before the window ends', () => {
    expect(secondsUntilSleepEnd(9 * 3600, new Date(2026, 0, 1, 8, 0, 0, 500))).toBe(3600)
  })

  it('floors at the minimum right at the boundary', () => {
    expect(secondsUntilSleepEnd(9 * 3600, time(8, 59, 30))).toBe(MIN_SLEEP_REFRESH_RATE)
  })
})

// The Device sleeps elapsed seconds, so on a night the Instance Time Zone's clock jumps, the
// answer is the real gap to the wake time — the same moment `nextSleepEnd` hands the UI.
describe('secondsUntilSleepEnd across a daylight saving change', () => {
  beforeEach(() => {
    vi.stubEnv('TZ', 'Europe/Berlin')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('counts the hour skipped when clocks spring forward', () => {
    expect(secondsUntilSleepEnd(7 * 3600, new Date(2026, 2, 29, 1, 0))).toBe(5 * 3600)
    expect(secondsUntilSleepEnd(7 * 3600, new Date(2026, 2, 28, 23, 0))).toBe(7 * 3600)
  })

  it('counts the hour repeated when clocks fall back', () => {
    expect(secondsUntilSleepEnd(7 * 3600, new Date(2026, 9, 25, 1, 0))).toBe(7 * 3600)
    expect(secondsUntilSleepEnd(7 * 3600, new Date(2026, 9, 24, 23, 0))).toBe(9 * 3600)
  })

  it('wakes at the second occurrence of a wake time inside the repeated hour', () => {
    const secondTwoFifteen = new Date('2026-10-25T01:15:00Z')
    expect(secondsUntilSleepEnd(2.5 * 3600, secondTwoFifteen)).toBe(15 * 60)
    expect(secondsUntilSleepEnd(2.5 * 3600, new Date('2026-10-25T00:15:00Z'))).toBe(15 * 60)
  })

  it('agrees with nextSleepEnd', () => {
    const now = new Date(2026, 2, 29, 1, 0)
    expect(now.getTime() + secondsUntilSleepEnd(7 * 3600, now) * 1000).toBe(nextSleepEnd(7 * 3600, now).getTime())
  })
})

describe('lastSleepEnd', () => {
  it('is today\'s wake time once it has passed', () => {
    expect(lastSleepEnd(7 * 3600, time(7, 0))).toEqual(time(7, 0))
    expect(lastSleepEnd(7 * 3600, time(12, 0))).toEqual(time(7, 0))
  })

  it('is yesterday\'s wake time before today\'s', () => {
    expect(lastSleepEnd(7 * 3600, time(6, 59))).toEqual(new Date(2025, 11, 31, 7, 0))
  })
})

// Yesterday's wake time is a day back on the Instance Time Zone's clock, so 23 or 25 hours
// back the day it jumps — and the moment `nextSleepEnd` named the day before.
describe('lastSleepEnd across a daylight saving change', () => {
  beforeEach(() => {
    vi.stubEnv('TZ', 'Europe/Berlin')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('reaches back 23 hours the day clocks spring forward', () => {
    expect(lastSleepEnd(7 * 3600, new Date(2026, 2, 29, 3, 30))).toEqual(new Date('2026-03-28T06:00:00Z'))
  })

  it('reaches back 25 hours the day clocks fall back', () => {
    expect(lastSleepEnd(7 * 3600, new Date(2026, 9, 25, 3, 30))).toEqual(new Date('2026-10-24T05:00:00Z'))
  })

  it('agrees with the nextSleepEnd of a day before, even for a wake time inside the skipped hour', () => {
    expect(lastSleepEnd(2.5 * 3600, new Date(2026, 2, 30, 1, 0))).toEqual(nextSleepEnd(2.5 * 3600, new Date(2026, 2, 29, 1, 0)))
  })

  it('is the second occurrence of a wake time inside the repeated hour once that has passed', () => {
    expect(lastSleepEnd(2.5 * 3600, new Date('2026-10-25T01:45:00Z'))).toEqual(new Date('2026-10-25T01:30:00Z'))
    expect(lastSleepEnd(2.5 * 3600, new Date('2026-10-25T00:45:00Z'))).toEqual(new Date('2026-10-25T00:30:00Z'))
  })
})

// America/Santiago springs forward at midnight, so the day it does there is no 00:00 to count from.
describe('the wake time on a day the clock skips midnight', () => {
  beforeEach(() => {
    vi.stubEnv('TZ', 'America/Santiago')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('still reads the wake time on the clock', () => {
    expect(lastSleepEnd(7 * 3600, new Date(2026, 8, 6, 12, 0)).getHours()).toBe(7)
    expect(nextSleepEnd(7 * 3600, new Date(2026, 8, 6, 2, 0)).getHours()).toBe(7)
  })
})
