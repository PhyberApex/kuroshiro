import type { Context } from 'liquidjs'
import { filters } from 'liquidjs'
import { toInteger } from './numbers.ts'

type DateFilter = (this: { context: Context }, value: unknown, format?: string) => unknown

/** liquidjs's own `date`, so these filters read the time zone and strftime table `date` does. */
function strftime(context: Context, value: unknown, format: string): string {
  return String((filters.date as unknown as DateFilter).call({ context }, value, format))
}

const isoDate = (date: Date) => date.toISOString().slice(0, 10)

/** Today's calendar date in an IANA zone, as `yyyy-mm-dd`. */
function todayIn(timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
  const part = (type: string) => parts.find(p => p.type === type)!.value
  return `${part('year')}-${part('month')}-${part('day')}`
}

/**
 * TRMNL's `days_ago(n, zone?)`: the ISO date that many calendar days before today. An explicit IANA zone is honoured;
 * without one, today is read in the zone `date` renders in (the Instance Time Zone), not the gem's UTC, so the two never differ by a day.
 */
export function daysAgo(context: Context, days: unknown, timeZone?: unknown): string {
  const today = timeZone === undefined ? strftime(context, new Date(), '%Y-%m-%d') : todayIn(String(timeZone))
  const [year, month, day] = today.split('-').map(Number)
  return isoDate(new Date(Date.UTC(year, month - 1, day - toInteger(days))))
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

/** TRMNL's `l_date`: strftime where the month and weekday names come from `Intl` in the given locale. */
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
