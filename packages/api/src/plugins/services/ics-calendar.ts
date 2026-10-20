import ICAL from 'ical.js'
import { utcOffsetSeconds } from '../../instance/instance-time-zone.js'

/** One occurrence of a calendar event as a Template reads it (ADR-0066). */
export interface CalendarEvent {
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
/** Occurrences one recurring event may be stepped through, so a rule repeating every minute for years still ends. */
const MAX_OCCURRENCES = 50_000

type Time = InstanceType<typeof ICAL.Time>
type Event = InstanceType<typeof ICAL.Event>
type Component = InstanceType<typeof ICAL.Component>
type Timezone = InstanceType<typeof ICAL.Timezone>

interface WallClock { year: number, month: number, day: number, hour: number, minute: number, second: number }

function isIanaZone(name: string): boolean {
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: name }).resolvedOptions().timeZone !== ''
  }
  catch {
    return false
  }
}

/** The instant a wall-clock time in an IANA zone names; of the two a fall-back hour repeats, the first. */
function instantOfWallClock(wall: WallClock, timeZone: string): number {
  const asUtc = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second)
  const guess = asUtc - utcOffsetSeconds(timeZone, new Date(asUtc)) * 1000
  return asUtc - utcOffsetSeconds(timeZone, new Date(guess)) * 1000
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

/** Reads a feed's times: in UTC, in the zone their TZID names (IANA, else the feed's own VTIMEZONE), or floating in the Instance Time Zone. */
class FeedClock {
  private readonly feedZones = new Map<string, Timezone>()

  constructor(calendar: Component, readonly timeZone: string) {
    for (const vtimezone of calendar.getAllSubcomponents('vtimezone')) {
      const zone = new ICAL.Timezone(vtimezone)
      this.feedZones.set(zone.tzid, zone)
    }
  }

  /** The zone a time under `tzid` is read in: the IANA zone it names, else the feed's VTIMEZONE of that name, else the Instance Time Zone. */
  private zoneOf(tzid: string | null): string | Timezone {
    if (!tzid)
      return this.timeZone
    return isIanaZone(tzid) ? tzid : this.feedZones.get(tzid) ?? this.timeZone
  }

  /** The instant `time` names, read in the zone its property's TZID gives; an all-day date starts at midnight here. */
  instant(time: Time, tzid: string | null): number {
    if (time.isDate)
      return instantOfWallClock(time, this.timeZone)
    if (time.zone === ICAL.Timezone.utcTimezone)
      return time.toUnixTime() * 1000
    const zone = this.zoneOf(tzid)
    if (typeof zone === 'string')
      return instantOfWallClock(time, zone)
    const zoned = time.clone()
    zoned.zone = zone
    return zoned.toUnixTime() * 1000
  }

  /** `time` as a Template reads it: an all-day date as `YYYY-MM-DD`, anything else as RFC 3339 in the Instance Time Zone. */
  format(time: Time, tzid: string | null): string {
    return time.isDate ? time.toString() : rfc3339(this.instant(time, tzid), this.timeZone)
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

function tzidOf(event: Event, property: 'dtstart' | 'dtend'): string | null {
  const parameter = event.component.getFirstProperty(property)?.getParameter('tzid')
  return typeof parameter === 'string' ? parameter : null
}

function textOf(event: Event, property: string): string | null {
  const value = event.component.getFirstPropertyValue(property)
  return typeof value === 'string' && value !== '' ? value : null
}

interface Occurrence { item: Event, start: Time, end: Time, startTzid: string | null, endTzid: string | null }

/** A one-off event as itself; a recurring one stepped from its first occurrence until the window and every override are passed. */
function occurrencesOf(event: Event, overrides: Event[], clock: FeedClock, until: number): Occurrence[] {
  if (!event.isRecurring()) {
    const endTzid = event.component.hasProperty('dtend') ? tzidOf(event, 'dtend') : tzidOf(event, 'dtstart')
    return [{ item: event, start: event.startDate, end: event.endDate, startTzid: tzidOf(event, 'dtstart'), endTzid }]
  }
  const startTzid = tzidOf(event, 'dtstart')
  const last = Math.max(until, ...overrides.map(override => clock.instant(override.recurrenceId, tzidOf(override, 'dtstart'))))
  const occurrences: Occurrence[] = []
  const iterator = event.iterator()
  for (let count = 0, next = iterator.next(); next && count < MAX_OCCURRENCES; count++, next = iterator.next()) {
    if (clock.instant(next, startTzid) >= last)
      break
    const details = event.getOccurrenceDetails(next)
    const tzid = details.item === event ? startTzid : tzidOf(details.item, 'dtstart')
    occurrences.push({ item: details.item, start: details.startDate, end: details.endDate, startTzid: tzid, endTzid: tzid })
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

/**
 * An iCalendar feed's events as a Template reads them (ADR-0066): every occurrence overlapping the window from the start
 * of today to thirty days on in the Instance Time Zone, recurrences expanded with their exclusions and overrides, sorted
 * by start. Nothing when the text is not one calendar.
 */
export function parseIcs(text: string, { timeZone, now }: CalendarClock): { events: CalendarEvent[] } | undefined {
  let calendar: Component
  try {
    const parsed: unknown = ICAL.parse(text)
    if (!Array.isArray(parsed) || parsed[0] !== 'vcalendar')
      return undefined
    calendar = new ICAL.Component(parsed)
  }
  catch {
    return undefined
  }
  const clock = new FeedClock(calendar, timeZone)
  const window = clock.window(now)
  const inWindow = eventsOf(calendar)
    .flatMap(({ event, overrides }) => occurrencesOf(event, overrides, clock, window.end))
    .map(occurrence => ({
      occurrence,
      start: clock.instant(occurrence.start, occurrence.startTzid),
      end: clock.instant(occurrence.end, occurrence.endTzid),
    }))
    .filter(({ start, end }) => start < window.end && (end > window.start || start >= window.start))
    .sort((a, b) => a.start - b.start)
  return {
    events: inWindow.map(({ occurrence: { item, start, end, startTzid, endTzid } }) => ({
      uid: textOf(item, 'uid'),
      summary: textOf(item, 'summary'),
      description: textOf(item, 'description'),
      location: textOf(item, 'location'),
      start: clock.format(start, startTzid),
      end: clock.format(end, endTzid),
      all_day: start.isDate,
      status: textOf(item, 'status'),
    })),
  }
}
