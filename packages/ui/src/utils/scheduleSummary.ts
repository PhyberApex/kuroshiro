import type { Schedule } from '@/types'

export const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function scheduleSummary(schedule: Schedule): string {
  const parts = [weekdaysLabel(schedule.weekdays)]
  if (schedule.startTime && schedule.endTime)
    parts.push(`${withoutSeconds(schedule.startTime)}–${withoutSeconds(schedule.endTime)}`)
  if (schedule.startDate && schedule.endDate)
    parts.push(`${schedule.startDate} → ${schedule.endDate}`)
  return parts.join(' · ')
}

function weekdaysLabel(weekdays: number[] | null | undefined): string {
  if (!weekdays?.length)
    return 'Every day'
  return [...weekdays].sort((a, b) => a - b).map(day => WEEKDAY_LABELS[day]).join(', ')
}

export function withoutSeconds(time: string): string {
  return time.slice(0, 5)
}
