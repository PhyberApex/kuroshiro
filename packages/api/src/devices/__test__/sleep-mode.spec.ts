import { describe, expect, it } from 'vitest'
import { isDeviceAsleep, MIN_SLEEP_REFRESH_RATE, secondsUntilSleepEnd } from '../sleep-mode.js'

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

  it('floors at the minimum right at the boundary', () => {
    expect(secondsUntilSleepEnd(9 * 3600, time(8, 59, 30))).toBe(MIN_SLEEP_REFRESH_RATE)
  })
})
