import type { Context } from 'liquidjs'
import { filters } from 'liquidjs'
import { toInteger } from './numbers.ts'

type DateFilter = (this: { context: Context }, value: unknown, format?: string) => unknown

/** A filter reading the render's context, as liquidjs binds it. */
export type ContextFilter<Args extends unknown[]> = (this: { context: Context }, ...args: Args) => unknown

const EXPLICIT_OFFSET = /(?:z|[+-]\d{2}:?\d{2})$/i

/**
 * liquidjs's own `date`, so these filters read the time zone and strftime table `date` does. A string that names its
 * own offset keeps it, as Ruby's `Time.parse` does, instead of being moved into the engine's zone. A value `date` cannot
 * read as a date comes back as `date` renders it: a string as itself, anything else (a missing value) as nothing.
 */
function strftime(context: Context, value: unknown, format: string): string {
  const preserveTimezones = typeof value === 'string' && EXPLICIT_OFFSET.test(value)
  const shim = preserveTimezones ? { context: { ...context, opts: { ...context.opts, preserveTimezones } } as Context } : { context }
  const formatted = (filters.date as unknown as DateFilter).call(shim, value, format)
  return typeof formatted === 'string' ? formatted : ''
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
export const daysAgo: ContextFilter<[days: unknown, timeZone?: unknown]> = function (days, timeZone) {
  const today = timeZone === undefined ? strftime(this.context, new Date(), '%Y-%m-%d') : todayIn(String(timeZone))
  const [year, month, day] = today.split('-').map(Number)
  return isoDate(new Date(Date.UTC(year, month - 1, day - toInteger(days))))
}

function ordinalOf(day: number): string {
  const tens = day % 100
  if (tens >= 11 && tens <= 13)
    return `${day}th`
  return `${day}${{ 1: 'st', 2: 'nd', 3: 'rd' }[day % 10] ?? 'th'}`
}

export const ordinalize: ContextFilter<[value: unknown, format?: string]> = function (value, format = '%A, %B <<ordinal_day>>, %Y') {
  const day = strftime(this.context, value, '%-d')
  if (!/^\d+$/.test(day))
    return day
  return strftime(this.context, value, format.replaceAll('<<ordinal_day>>', ordinalOf(Number(day))))
}

const NAMED = /%([aAbBh])/g

/** TRMNL's `l_date`: strftime where the month and weekday names come from `Intl` in the given locale. */
export const localizeDate: ContextFilter<[value: unknown, format?: string, locale?: unknown]> = function (value, format = '%b %-d, %Y', locale = 'en') {
  const monthAndWeekday = strftime(this.context, value, '%-m %w')
  if (!/^\d+ \d$/.test(monthAndWeekday))
    return monthAndWeekday
  const [month, weekday] = monthAndWeekday.split(' ').map(Number)
  const name = (kind: string) => {
    const long = kind === 'A' || kind === 'B'
    const ofWeekday = kind === 'a' || kind === 'A'
    const date = new Date(ofWeekday ? Date.UTC(2021, 0, 3 + weekday) : Date.UTC(2021, month - 1, 15))
    const options: Intl.DateTimeFormatOptions = ofWeekday
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
  return strftime(this.context, value, literal)
}
