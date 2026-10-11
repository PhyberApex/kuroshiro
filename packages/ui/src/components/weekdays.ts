/** A weekday as a Schedule holds it: 0 is Sunday. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6

/** Monday first, by a Schedule's weekday number, where 0 is Sunday. */
export const MONDAY_FIRST: { weekday: Weekday, letter: string, name: string }[] = [
  { weekday: 1, letter: 'M', name: 'Monday' },
  { weekday: 2, letter: 'T', name: 'Tuesday' },
  { weekday: 3, letter: 'W', name: 'Wednesday' },
  { weekday: 4, letter: 'T', name: 'Thursday' },
  { weekday: 5, letter: 'F', name: 'Friday' },
  { weekday: 6, letter: 'S', name: 'Saturday' },
  { weekday: 0, letter: 'S', name: 'Sunday' },
]
