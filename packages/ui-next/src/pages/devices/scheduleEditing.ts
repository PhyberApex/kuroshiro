import type { ScheduleInput, ScheduleRead } from 'kuroshiro-shared'
import type { Weekday } from '@/components/WeekdayToggle.vue'

const EVERY_WEEKDAY: Weekday[] = [0, 1, 2, 3, 4, 5, 6]

/** The days a Schedule runs on, as `WeekdayToggle` holds them: 0 is Sunday, and a Schedule that names no day runs on every day. */
export function selectedWeekdays(stored: ScheduleRead['weekdays']): Weekday[] {
  return stored?.length ? stored as Weekday[] : EVERY_WEEKDAY
}

/** What "Add a Schedule" creates. */
export const EVERY_DAY_ALL_DAY: ScheduleInput = { enabled: true, weekdays: null, startTime: null, endTime: null, startDate: null, endDate: null }

/** The hours unchecking "All day" fills in. */
export const DEFAULT_HOURS = { startTime: '06:00', endTime: '09:00' } as const

export function crossesMidnight(from: string | null, to: string | null) {
  return !!from && !!to && to < from
}

type PairKey = 'startTime' | 'endTime' | 'startDate' | 'endDate'

/**
 * What a pair of times or dates sends: the ends that differ from the saved Schedule, once both are filled in.
 * `undefined` while one is empty and when nothing differs, so that half a pair is never sent.
 */
export function changedOfPair<Key extends PairKey>(saved: ScheduleRead, pair: Record<Key, string | null>): Partial<Record<Key, string>> | undefined {
  const ends = Object.entries(pair) as [Key, string | null][]
  if (ends.some(([, value]) => !value))
    return undefined
  const changed = ends.filter(([key, value]) => value !== saved[key])
  return changed.length > 0 ? Object.fromEntries(changed) as Partial<Record<Key, string>> : undefined
}

/** The calendar day it is in a timezone, as `YYYY-MM-DD`. A Schedule's dates are the server's, so "today" is too. */
export function dateInZone(now: Date, timezone: string | undefined) {
  return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: timezone }).format(now)
}

const DAYS_OF_A_WEEK = 7

export function weekFrom(day: string) {
  const date = new Date(`${day}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + DAYS_OF_A_WEEK)
  return date.toISOString().slice(0, 'YYYY-MM-DD'.length)
}

export function dateRangeProblem(firstDay: string | null, lastDay: string | null) {
  return firstDay && lastDay && firstDay > lastDay ? 'The first day is after the last day.' : undefined
}

export function timezoneLine(timezone: string | undefined) {
  return timezone
    ? `Hours and dates are in the server's timezone, ${timezone}.`
    : 'Hours and dates are in the server\'s timezone.'
}
