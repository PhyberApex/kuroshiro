import type { ScheduleRead } from 'kuroshiro-shared'
import { MONDAY_FIRST } from '@/components/weekdays'

export function scheduleHours({ startTime, endTime }: Pick<ScheduleRead, 'startTime' | 'endTime'>) {
  return startTime && endTime ? `${startTime}–${endTime}` : 'all day'
}

/** The seven day marks and the hours of a row's Schedule summary, with the same said in words. */
export function scheduleSummary(schedule: ScheduleRead) {
  const everyDay = !schedule.weekdays?.length
  const days = MONDAY_FIRST.map(({ weekday, letter, name }) => ({ letter, name, on: everyDay || schedule.weekdays!.includes(weekday) }))
  const hours = scheduleHours(schedule)
  const saidDays = days.every(day => day.on) ? 'Every day' : days.filter(day => day.on).map(day => day.name).join(', ')
  return { days, hours, said: `${saidDays}, ${hours}` }
}
