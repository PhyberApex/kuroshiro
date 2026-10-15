import type { Context } from 'liquidjs'
import { filters } from 'liquidjs'

type DateFilter = (this: { context: Context }, value: unknown, format?: string) => unknown

/** liquidjs's own `date`, so these filters read the time zone and strftime table `date` does. */
function strftime(context: Context, value: unknown, format: string): string {
  return String((filters.date as unknown as DateFilter).call({ context }, value, format))
}

const DAY = 86_400_000

export function daysAgo(context: Context, days: unknown): string {
  return strftime(context, new Date(Date.now() - Number(days) * DAY), '%Y-%m-%d')
}

function ordinalOf(day: number): string {
  const tens = day % 100
  if (tens >= 11 && tens <= 13)
    return `${day}th`
  return `${day}${{ 1: 'st', 2: 'nd', 3: 'rd' }[day % 10] ?? 'th'}`
}

export function ordinalize(context: Context, value: unknown, format = '%A, %B <<ordinal_day>>, %Y'): string {
  const day = Number(strftime(context, value, '%-d'))
  return strftime(context, value, format.replaceAll('<<ordinal_day>>', ordinalOf(day)))
}

const NAMED = /%([aAbBh])/g

/** `l_date`: strftime where the month and weekday names come from `Intl` in the given locale. */
export function localizeDate(context: Context, value: unknown, format = '%b %-d, %Y', locale: unknown = 'en'): string {
  const [month, weekday] = strftime(context, value, '%-m %w').split(' ').map(Number)
  const name = (kind: string) => {
    const long = kind === 'A' || kind === 'B'
    const date = new Date(kind === 'a' || kind === 'A' ? Date.UTC(2021, 0, 3 + weekday) : Date.UTC(2021, month - 1, 15))
    const options: Intl.DateTimeFormatOptions = kind === 'a' || kind === 'A'
      ? { weekday: long ? 'long' : 'short', timeZone: 'UTC' }
      : { month: long ? 'long' : 'short', timeZone: 'UTC' }
    try {
      return date.toLocaleDateString(String(locale), options)
    }
    catch {
      return date.toLocaleDateString('en', options)
    }
  }
  // The names are inserted as literals, so a `%` in one cannot be read as a directive.
  const literal = format.replace(NAMED, (_all, kind: string) => name(kind).replaceAll('%', '%%'))
  return strftime(context, value, literal)
}
