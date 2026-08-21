import type { Schedule } from '../schedule.entity'
import { describe, expect, it } from 'vitest'
import { isScheduleEligible } from '../schedule-eligibility'

function schedule(overrides: Partial<Schedule>): Schedule {
  return { enabled: true, ...overrides } as Schedule
}

// Moments are written without a zone so they parse as server-local time.
// 2026-08-21 is a Friday, 2026-08-22 a Saturday.
describe('isScheduleEligible', () => {
  it('treats a Screen without a Schedule as always eligible', () => {
    expect(isScheduleEligible(null, new Date('2026-08-21T03:00:00'))).toBe(true)
    expect(isScheduleEligible(undefined, new Date('2026-08-21T03:00:00'))).toBe(true)
  })

  it('treats a Schedule with no constraints as always eligible', () => {
    expect(isScheduleEligible(schedule({}), new Date('2026-08-22T23:59:00'))).toBe(true)
  })

  it('makes a disabled Schedule ineligible even when its day and time rules match', () => {
    const disabled = schedule({ enabled: false, weekdays: [5], startTime: '00:00', endTime: '23:59' })
    expect(isScheduleEligible(disabled, new Date('2026-08-21T12:00:00'))).toBe(false)
  })

  describe('weekdays', () => {
    const weekdaysOnly = schedule({ weekdays: [1, 2, 3, 4, 5] })

    it('is eligible on a selected weekday', () => {
      expect(isScheduleEligible(weekdaysOnly, new Date('2026-08-21T12:00:00'))).toBe(true)
    })

    it('is ineligible on an unselected weekday', () => {
      expect(isScheduleEligible(weekdaysOnly, new Date('2026-08-22T12:00:00'))).toBe(false)
    })

    it('is eligible every day when the weekday list is empty', () => {
      expect(isScheduleEligible(schedule({ weekdays: [] }), new Date('2026-08-22T12:00:00'))).toBe(true)
    })
  })

  describe('time-of-day window', () => {
    const morning = schedule({ startTime: '07:00', endTime: '09:00' })

    it('is eligible inside the window', () => {
      expect(isScheduleEligible(morning, new Date('2026-08-21T08:30:00'))).toBe(true)
    })

    it('is eligible on both boundaries', () => {
      expect(isScheduleEligible(morning, new Date('2026-08-21T07:00:00'))).toBe(true)
      expect(isScheduleEligible(morning, new Date('2026-08-21T09:00:00'))).toBe(true)
    })

    it('is ineligible outside the window', () => {
      expect(isScheduleEligible(morning, new Date('2026-08-21T06:59:00'))).toBe(false)
      expect(isScheduleEligible(morning, new Date('2026-08-21T09:01:00'))).toBe(false)
    })

    it('spans midnight when the start time is later than the end time', () => {
      const overnight = schedule({ startTime: '22:00', endTime: '02:00' })
      expect(isScheduleEligible(overnight, new Date('2026-08-21T23:00:00'))).toBe(true)
      expect(isScheduleEligible(overnight, new Date('2026-08-21T01:00:00'))).toBe(true)
      expect(isScheduleEligible(overnight, new Date('2026-08-21T12:00:00'))).toBe(false)
    })

    it('accepts times stored with seconds, as Postgres returns them', () => {
      const stored = schedule({ startTime: '07:00:00', endTime: '09:00:00' })
      expect(isScheduleEligible(stored, new Date('2026-08-21T08:30:00'))).toBe(true)
      expect(isScheduleEligible(stored, new Date('2026-08-21T10:30:00'))).toBe(false)
    })
  })

  describe('date range', () => {
    const december = schedule({ startDate: '2026-12-01', endDate: '2026-12-25' })

    it('is eligible inside the range, boundaries included', () => {
      expect(isScheduleEligible(december, new Date('2026-12-01T00:00:00'))).toBe(true)
      expect(isScheduleEligible(december, new Date('2026-12-13T12:00:00'))).toBe(true)
      expect(isScheduleEligible(december, new Date('2026-12-25T23:59:00'))).toBe(true)
    })

    it('is ineligible outside the range', () => {
      expect(isScheduleEligible(december, new Date('2026-11-30T23:59:00'))).toBe(false)
      expect(isScheduleEligible(december, new Date('2026-12-26T00:00:00'))).toBe(false)
    })

    it('accepts dates stored as Date objects', () => {
      const stored = schedule({ startDate: new Date('2026-12-01T00:00:00') as any, endDate: new Date('2026-12-25T00:00:00') as any })
      expect(isScheduleEligible(stored, new Date('2026-12-13T12:00:00'))).toBe(true)
      expect(isScheduleEligible(stored, new Date('2026-12-26T12:00:00'))).toBe(false)
    })
  })

  it('requires every configured dimension to match', () => {
    const weekdayMorningInDecember = schedule({
      weekdays: [1, 2, 3, 4, 5],
      startTime: '07:00',
      endTime: '09:00',
      startDate: '2026-12-01',
      endDate: '2026-12-25',
    })
    expect(isScheduleEligible(weekdayMorningInDecember, new Date('2026-12-04T08:00:00'))).toBe(true)
    expect(isScheduleEligible(weekdayMorningInDecember, new Date('2026-12-05T08:00:00'))).toBe(false)
    expect(isScheduleEligible(weekdayMorningInDecember, new Date('2026-12-04T18:00:00'))).toBe(false)
    expect(isScheduleEligible(weekdayMorningInDecember, new Date('2026-11-04T08:00:00'))).toBe(false)
  })
})
