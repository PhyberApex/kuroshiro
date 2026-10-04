import type { ScheduleRead } from 'kuroshiro-shared'

/** Monday first, by a Schedule's weekday number, where 0 is Sunday. */
const WEEK = [
  { weekday: 1, letter: 'M', name: 'Monday' },
  { weekday: 2, letter: 'T', name: 'Tuesday' },
  { weekday: 3, letter: 'W', name: 'Wednesday' },
  { weekday: 4, letter: 'T', name: 'Thursday' },
  { weekday: 5, letter: 'F', name: 'Friday' },
  { weekday: 6, letter: 'S', name: 'Saturday' },
  { weekday: 0, letter: 'S', name: 'Sunday' },
] as const

export function scheduleHours({ startTime, endTime }: Pick<ScheduleRead, 'startTime' | 'endTime'>) {
  return startTime && endTime ? `${startTime}–${endTime}` : 'all day'
}

/** The seven day marks and the hours of a row's Schedule summary, with the same said in words. */
export function scheduleSummary(schedule: ScheduleRead) {
  const everyDay = !schedule.weekdays?.length
  const days = WEEK.map(({ weekday, letter, name }) => ({ letter, name, on: everyDay || schedule.weekdays!.includes(weekday) }))
  const hours = scheduleHours(schedule)
  const saidDays = days.every(day => day.on) ? 'Every day' : days.filter(day => day.on).map(day => day.name).join(', ')
  return { days, hours, said: `${saidDays}, ${hours}` }
}
