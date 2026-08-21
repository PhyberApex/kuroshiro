import type { Schedule, Screen } from '@/types'

export const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function scheduleSummary(schedule: Schedule): string {
  const parts = [weekdaysLabel(schedule.weekdays)]
  if (schedule.startTime && schedule.endTime)
    parts.push(`${withoutSeconds(schedule.startTime)}–${withoutSeconds(schedule.endTime)}`)
  if (schedule.startDate && schedule.endDate)
    parts.push(`${schedule.startDate} → ${schedule.endDate}`)
  return parts.join(' · ')
}

export function screenScheduleLabel(screen: Screen): string {
  if (!screen.schedule)
    return 'Always'
  const summary = scheduleSummary(screen.schedule)
  return screen.schedule.enabled ? summary : `Disabled · ${summary}`
}

export function screenScheduleColor(screen: Screen): string {
  if (!screen.schedule)
    return 'secondary'
  return screen.schedule.enabled ? 'success' : 'warning'
}

export function withoutSeconds(time: string): string {
  return time.slice(0, 5)
}

function weekdaysLabel(weekdays: number[] | null | undefined): string {
  if (!weekdays?.length)
    return 'Every day'
  return [...weekdays].sort((a, b) => a - b).map(day => WEEKDAY_LABELS[day]).join(', ')
}
