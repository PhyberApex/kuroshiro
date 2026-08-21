import type { Schedule } from './schedule.entity'

/**
 * All constraints are evaluated against the server process's local timezone —
 * Devices have no timezone of their own (ADR-0009).
 */
export function isScheduleEligible(schedule: Schedule | null | undefined, now: Date): boolean {
  if (!schedule)
    return true
  if (!schedule.enabled)
    return false
  return matchesWeekday(schedule.weekdays, now)
    && matchesTimeWindow(schedule.startTime, schedule.endTime, now)
    && matchesDateRange(schedule.startDate, schedule.endDate, now)
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
