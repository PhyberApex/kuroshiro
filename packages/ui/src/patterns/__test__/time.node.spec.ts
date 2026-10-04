import { describe, expect, it } from 'vitest'
import { clockTime, exactTime, relativeTime } from '../time'

const now = new Date(2026, 9, 3, 7, 35, 20)
const ago = (ms: number) => new Date(now.getTime() - ms)
const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE

describe('relativeTime', () => {
  it.each([
    [20 * SECOND, 'just now'],
    [59 * SECOND, 'just now'],
    [MINUTE, '1 min ago'],
    [4 * MINUTE + 40 * SECOND, '4 min ago'],
    [59 * MINUTE, '59 min ago'],
    [HOUR, '1 h ago'],
    [3 * HOUR + 50 * MINUTE, '3 h ago'],
    [23 * HOUR + 59 * MINUTE, '23 h ago'],
  ])('words a time %i ms back as "%s"', (ms, wording) => {
    expect(relativeTime(ago(ms), now)).toBe(wording)
  })

  it('has no relative wording for a time a day or more back', () => {
    expect(relativeTime(ago(24 * HOUR), now)).toBeUndefined()
  })

  it('takes a time slightly ahead, from a clock that runs fast, for now', () => {
    expect(relativeTime(ago(-5 * SECOND), now)).toBe('just now')
  })

  it('has no relative wording for a time that is really ahead', () => {
    expect(relativeTime(ago(-10 * MINUTE), now)).toBeUndefined()
  })
})

describe('exactTime and clockTime', () => {
  it('writes a date and time in the browser\'s timezone, on the 24-hour clock', () => {
    expect(exactTime(new Date(2026, 9, 1, 7, 31))).toBe('1 Oct 2026, 07:31')
    expect(exactTime(new Date(2026, 11, 24, 18, 5))).toBe('24 Dec 2026, 18:05')
  })

  it('writes the time of a poll as hh:mm', () => {
    expect(clockTime(new Date(2026, 9, 1, 7, 31))).toBe('07:31')
    expect(clockTime(new Date(2026, 9, 1, 0, 4))).toBe('00:04')
  })
})
