import type { ScreenStateCause } from 'kuroshiro-shared'
import type { Schedule } from './schedule.entity.js'

export type ScheduleExclusion
  = | { state: 'scheduleOff', stateCause: null }
    | { state: 'notToday', stateCause: ScreenStateCause }
    | { state: 'notThisHour', stateCause: null }

/**
 * Why a Schedule keeps its Screen out of Rotation at `now`, or `null` when it
 * lets the Screen show. The first reason that applies wins: switched off, then
 * the weekday, then the date range, then the hours.
 *
 * All constraints are evaluated against the server process's local timezone —
 * Devices have no timezone of their own (ADR-0009).
 */
export function scheduleExclusion(schedule: Schedule | null | undefined, now: Date): ScheduleExclusion | null {
  if (!schedule)
    return null
  if (!schedule.enabled)
    return { state: 'scheduleOff', stateCause: null }
  if (!matchesWeekday(schedule.weekdays, now))
    return { state: 'notToday', stateCause: 'weekday' }
  if (!matchesDateRange(schedule.startDate, schedule.endDate, now))
    return { state: 'notToday', stateCause: 'dateRange' }
  if (!matchesTimeWindow(schedule.startTime, schedule.endTime, now))
    return { state: 'notThisHour', stateCause: null }
  return null
}

export function isScheduleEligible(schedule: Schedule | null | undefined, now: Date): boolean {
  return scheduleExclusion(schedule, now) === null
}

function matchesWeekday(weekdays: number[] | null | undefined, now: Date): boolean {
  if (!weekdays?.length)
    return true
  return weekdays.includes(now.getDay())
}

function matchesTimeWindow(startTime: string | null | undefined, endTime: string | null | undefined, now: Date): boolean {
  if (!startTime || !endTime)
    return true
  const start = minutesOfDay(startTime)
  const end = minutesOfDay(endTime)
  const current = now.getHours() * 60 + now.getMinutes()
  // A start later than the end means the window spans midnight (e.g. 22:00–02:00).
  return start > end
    ? current >= start || current <= end
    : current >= start && current <= end
}

function matchesDateRange(startDate: string | Date | null | undefined, endDate: string | Date | null | undefined, now: Date): boolean {
  if (!startDate || !endDate)
    return true
  const today = localDateString(now)
  return today >= localDateString(startDate) && today <= localDateString(endDate)
}

function minutesOfDay(time: string): number {
  const [hours, minutes] = time.split(':')
  return Number(hours) * 60 + Number(minutes)
}

function localDateString(value: string | Date): string {
  if (typeof value === 'string')
    return value.slice(0, 10)
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}
