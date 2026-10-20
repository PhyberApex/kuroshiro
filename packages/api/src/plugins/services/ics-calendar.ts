import ICAL from 'ical.js'
import { utcOffsetSeconds } from '../../instance/instance-time-zone.js'

/** One occurrence of a calendar event as a Template reads it (ADR-0066). */
interface CalendarEvent {
  uid: string | null
  summary: string | null
  description: string | null
  location: string | null
  /** RFC 3339 with the Instance Time Zone's offset, or `YYYY-MM-DD` for an all-day event. */
  start: string
  /** As `start`; an all-day event's end is the day after its last, as iCalendar has it. */
  end: string
  all_day: boolean
  status: string | null
}

/** The zone a feed's times are shown in and the moment its window is laid around. */
export interface CalendarClock {
  timeZone: string
  now: Date
}

const WINDOW_DAYS = 30
const DAY_MS = 24 * 60 * 60 * 1000
/** Occurrences one recurring event is stepped through from its first, so a rule repeating every minute for years still ends. */
const MAX_OCCURRENCES = 50_000

type Time = InstanceType<typeof ICAL.Time>
type Event = InstanceType<typeof ICAL.Event>
type Component = InstanceType<typeof ICAL.Component>
type Timezone = InstanceType<typeof ICAL.Timezone>

interface WallClock { year: number, month: number, day: number, hour: number, minute: number, second: number }

function isIanaZone(name: string): boolean {
  try {
    utcOffsetSeconds(name, new Date(0))
    return true
  }
  catch {
    return false
  }
}

/**
 * The instant a wall-clock time in an IANA zone names: of the two a fall-back hour repeats, the earlier; a time a
 * spring-forward skips reads at the offset before it.
 */
function instantOfWallClock(wall: WallClock, timeZone: string): number {
  const asUtc = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second)
  const offsetBefore = utcOffsetSeconds(timeZone, new Date(asUtc - DAY_MS))
  const offsetAfter = utcOffsetSeconds(timeZone, new Date(asUtc + DAY_MS))
  const readings = [offsetBefore, offsetAfter]
    .map(offset => asUtc - offset * 1000)
    .filter(instant => utcOffsetSeconds(timeZone, new Date(instant)) * 1000 === asUtc - instant)
  return readings.length > 0 ? Math.min(...readings) : asUtc - offsetBefore * 1000
}

const pad = (value: number, width = 2) => String(Math.abs(value)).padStart(width, '0')

/** The instant as RFC 3339 with `timeZone`'s offset at that instant, as `2026-10-21T09:00:00+02:00`. */
function rfc3339(instant: number, timeZone: string): string {
  const offset = utcOffsetSeconds(timeZone, new Date(instant))
  const wall = new Date(instant + offset * 1000)
  const sign = offset < 0 ? '-' : '+'
  const minutes = Math.floor(Math.abs(offset) / 60)
  return `${pad(wall.getUTCFullYear(), 4)}-${pad(wall.getUTCMonth() + 1)}-${pad(wall.getUTCDate())}T${pad(wall.getUTCHours())}:${pad(wall.getUTCMinutes())}:${pad(wall.getUTCSeconds())}${sign}${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`
}

/** An ical.js zone whose offsets come from the IANA database, for a TZID that names one, VTIMEZONE or not. */
function ianaTimezone(tzid: string): Timezone {
  const zone = new ICAL.Timezone({ tzid })
  zone.utcOffset = (time: Time) => (Date.UTC(time.year, time.month - 1, time.day, time.hour, time.minute, time.second) - instantOfWallClock(time, tzid)) / 1000
  return zone
}

/**
 * Runs `read` with every TZID the calendar's events use known to ical.js, so its exclusions, overrides and `UNTIL`
 * compare instants across zones: an IANA name from the IANA database, any other name from the feed's own VTIMEZONE.
 * A TZID neither covers stays floating. ical.js resolves a TZID through one shared registry when a value is first read,
 * so the zones are registered for this synchronous read only.
 */
function withFeedZones<T>(calendar: Component, read: () => T): T {
  const feedZones = new Map(calendar.getAllSubcomponents('vtimezone').map((vtimezone) => {
    const zone = new ICAL.Timezone(vtimezone)
    return [zone.tzid, zone] as const
  }))
  const tzids = new Set(calendar.getAllSubcomponents('vevent')
    .flatMap(vevent => vevent.getAllProperties().map(property => property.getParameter('tzid')))
    .filter((tzid): tzid is string => typeof tzid === 'string' && !ICAL.TimezoneService.has(tzid)))
  const registered: string[] = []
  for (const tzid of tzids) {
    const zone = isIanaZone(tzid) ? ianaTimezone(tzid) : feedZones.get(tzid)
    if (zone) {
      ICAL.TimezoneService.register(zone, tzid)
      registered.push(tzid)
    }
  }
  try {
    return read()
  }
  finally {
    registered.forEach(tzid => ICAL.TimezoneService.remove(tzid))
  }
}

/** Reads a feed's times as instants and shows them in the Instance Time Zone, where a floating time and an all-day date are read too. */
class FeedClock {
  constructor(readonly timeZone: string) {}

  instant(time: Time): number {
    return time.isDate || time.zone === ICAL.Timezone.localTimezone ? instantOfWallClock(time, this.timeZone) : time.toUnixTime() * 1000
  }

  /** `time` as a Template reads it: an all-day date as `YYYY-MM-DD`, anything else as RFC 3339 in the Instance Time Zone. */
  format(time: Time): string {
    return time.isDate ? time.toString() : rfc3339(this.instant(time), this.timeZone)
  }

  /** From the start of today here to the start of the day thirty days on. */
  window(now: Date): { start: number, end: number } {
    const today = new Date(now.getTime() + utcOffsetSeconds(this.timeZone, now) * 1000)
    const day = (offset: number) => {
      const date = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + offset))
      return instantOfWallClock({ year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate(), hour: 0, minute: 0, second: 0 }, this.timeZone)
    }
    return { start: day(0), end: day(WINDOW_DAYS) }
  }
}

function textOf(event: Event, property: string): string | null {
  const value = event.component.getFirstPropertyValue(property)
  return typeof value === 'string' && value !== '' ? value : null
}

interface Occurrence { item: Event, start: Time, end: Time }

/** A one-off event as itself; a recurring one stepped from its first occurrence until the window and every override are passed. */
function occurrencesOf(event: Event, overrides: Event[], clock: FeedClock, until: number): Occurrence[] {
  if (!event.isRecurring())
    return [{ item: event, start: event.startDate, end: event.endDate }]
  const last = Math.max(until, ...overrides.map(override => clock.instant(override.recurrenceId)))
  const occurrences: Occurrence[] = []
  const iterator = event.iterator()
  for (let count = 0, next = iterator.next(); next && count < MAX_OCCURRENCES; count++, next = iterator.next()) {
    if (clock.instant(next) > last)
      break
    const { item, startDate, endDate } = event.getOccurrenceDetails(next)
    occurrences.push({ item, start: startDate, end: endDate })
  }
  return occurrences
}

/** The calendar's VEVENTs, each override of a recurring event related to it by UID; an override without its event stands alone. */
function eventsOf(calendar: Component): { event: Event, overrides: Event[] }[] {
  const events = calendar.getAllSubcomponents('vevent').map(vevent => new ICAL.Event(vevent))
  const recurring = new Map<string, { event: Event, overrides: Event[] }>()
  const standalone: { event: Event, overrides: Event[] }[] = []
  for (const event of events.filter(candidate => !candidate.isRecurrenceException())) {
    const entry = { event, overrides: [] }
    if (event.uid && event.isRecurring())
      recurring.set(event.uid, entry)
    else
      standalone.push(entry)
  }
  for (const override of events.filter(candidate => candidate.isRecurrenceException())) {
    const master = recurring.get(override.uid)
    if (master) {
      master.event.relateException(override)
      master.overrides.push(override)
    }
    else {
      standalone.push({ event: override, overrides: [] })
    }
  }
  return [...recurring.values(), ...standalone]
}

/** One calendar's occurrences overlapping the window, each with the instants it starts and ends at. */
function occurrencesInWindow(calendar: Component, clock: FeedClock, window: { start: number, end: number }) {
  return withFeedZones(calendar, () => eventsOf(calendar)
    .flatMap(({ event, overrides }) => occurrencesOf(event, overrides, clock, window.end))
    .map(occurrence => ({ occurrence, start: clock.instant(occurrence.start), end: clock.instant(occurrence.end) }))
    .filter(({ start, end }) => start < window.end && (end > window.start || start >= window.start))
    .map(({ occurrence: { item, start, end }, start: at }): CalendarEvent & { at: number } => ({
      uid: textOf(item, 'uid'),
      summary: textOf(item, 'summary'),
      description: textOf(item, 'description'),
      location: textOf(item, 'location'),
      start: clock.format(start),
      end: clock.format(end),
      all_day: start.isDate,
      status: textOf(item, 'status'),
      at,
    })))
}

/** The calendars a feed holds, one or several in a row; nothing when it is not iCalendar. */
function calendarsOf(text: string): Component[] | undefined {
  try {
    const parsed: unknown = ICAL.parse(text)
    const roots = Array.isArray(parsed) && typeof parsed[0] === 'string' ? [parsed] : parsed
    if (!Array.isArray(roots) || roots.length === 0 || !roots.every(root => Array.isArray(root) && root[0] === 'vcalendar'))
      return undefined
    return roots.map(root => new ICAL.Component(root))
  }
  catch {
    return undefined
  }
}

/**
 * An iCalendar feed's events as a Template reads them (ADR-0066): every occurrence overlapping the window from the start
 * of today to thirty days on in the Instance Time Zone, recurrences expanded with their exclusions and overrides, sorted
 * by start. Nothing when the text is not iCalendar.
 */
export function parseIcs(text: string, { timeZone, now }: CalendarClock): { events: CalendarEvent[] } | undefined {
  const calendars = calendarsOf(text)
  if (!calendars)
    return undefined
  const clock = new FeedClock(timeZone)
  const window = clock.window(now)
  const events = calendars
    .flatMap(calendar => occurrencesInWindow(calendar, clock, window))
    .sort((a, b) => a.at - b.at)
    .map(({ at: _at, ...event }) => event)
  return { events }
}
