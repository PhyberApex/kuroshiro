import { describe, expect, it } from 'vitest'
import { buildSchedule } from '@/testing/fixtures/screens'
import { changedOfPair, crossesMidnight, dateInZone, dateRangeProblem, EVERY_DAY_ALL_DAY, selectedWeekdays, timezoneLine, weekFrom } from '../scheduleEditing'

describe('the weekdays of a Schedule', () => {
  it('reads a Schedule without weekdays as every day, Sunday as 0 included', () => {
    expect(selectedWeekdays(null)).toEqual([0, 1, 2, 3, 4, 5, 6])
    expect(selectedWeekdays([])).toEqual([0, 1, 2, 3, 4, 5, 6])
  })

  it('reads stored weekdays as they are', () => {
    expect(selectedWeekdays([0, 6])).toEqual([0, 6])
    expect(selectedWeekdays([1, 2, 3, 4, 5])).toEqual([1, 2, 3, 4, 5])
  })
})

describe('a new Schedule', () => {
  it('is on, every day and all day', () => {
    expect(EVERY_DAY_ALL_DAY).toEqual({ enabled: true, weekdays: null, startTime: null, endTime: null, startDate: null, endDate: null })
  })
})

describe('the hours of a Schedule', () => {
  it.each([
    ['22:00', '06:00', true],
    ['06:00', '09:00', false],
    ['06:00', '06:00', false],
    [null, '06:00', false],
    ['22:00', null, false],
  ])('from %s to %s crosses midnight: %s', (from, to, crosses) => {
    expect(crossesMidnight(from, to)).toBe(crosses)
  })
})

describe('what a pair of times or dates sends', () => {
  const saved = buildSchedule({ startTime: '06:00', endTime: '09:00' })

  it('sends only the end that changed', () => {
    expect(changedOfPair(saved, { startTime: '07:00', endTime: '09:00' })).toEqual({ startTime: '07:00' })
    expect(changedOfPair(saved, { startTime: '06:00', endTime: '10:30' })).toEqual({ endTime: '10:30' })
  })

  it('sends both ends when both differ from what is saved', () => {
    expect(changedOfPair(saved, { startTime: '21:00', endTime: '05:00' })).toEqual({ startTime: '21:00', endTime: '05:00' })
    expect(changedOfPair(buildSchedule(), { startDate: '2026-10-03', endDate: '2026-10-10' })).toEqual({ startDate: '2026-10-03', endDate: '2026-10-10' })
  })

  it('sends nothing while an end is empty, and nothing for what is saved already', () => {
    expect(changedOfPair(saved, { startTime: null, endTime: '10:00' })).toBeUndefined()
    expect(changedOfPair(saved, { startTime: '07:00', endTime: null })).toBeUndefined()
    expect(changedOfPair(saved, { startTime: '06:00', endTime: '09:00' })).toBeUndefined()
  })
})

describe('the date range of a Schedule', () => {
  it('reads today in the server\'s timezone, not the browser\'s', () => {
    const lateEvening = new Date('2026-10-03T23:30:00.000Z')

    expect(dateInZone(lateEvening, 'Europe/Berlin')).toBe('2026-10-04')
    expect(dateInZone(lateEvening, 'America/New_York')).toBe('2026-10-03')
  })

  it('counts a week on, across the end of a month', () => {
    expect(weekFrom('2026-10-03')).toBe('2026-10-10')
    expect(weekFrom('2026-12-28')).toBe('2027-01-04')
  })

  it('refuses a first day after the last day, and allows one day alone', () => {
    expect(dateRangeProblem('2026-10-11', '2026-10-10')).toBe('The first day is after the last day.')
    expect(dateRangeProblem('2026-10-10', '2026-10-10')).toBeUndefined()
    expect(dateRangeProblem('2026-10-10', null)).toBeUndefined()
  })
})

describe('the timezone line', () => {
  it('names the server\'s timezone, and does without the name until it is known', () => {
    expect(timezoneLine('Europe/Berlin')).toBe('Hours and dates are in the server\'s timezone, Europe/Berlin.')
    expect(timezoneLine(undefined)).toBe('Hours and dates are in the server\'s timezone.')
  })
})
