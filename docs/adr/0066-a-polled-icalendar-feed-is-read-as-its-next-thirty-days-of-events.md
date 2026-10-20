# A polled iCalendar feed is read as its next thirty days of events

Calendar screens are one of the most common TRMNL recipes, and most calendar providers (Google Calendar, iCloud, Outlook) publish a calendar only as an iCalendar feed. Kuroshiro handed such a feed to the Template as one string, which Liquid cannot read; a calendar Plugin needed a proxy or a transform that parsed RFC 5545 by hand. Terminus reads an `.ics` Data Source into events.

**A fetched body is read as a calendar when its content type is `text/calendar` or it starts with `BEGIN:VCALENDAR`**, the second for feeds served as `text/plain` or `application/octet-stream`. It joins the media-type dispatch of ADR-0059: JSON still wins first, and a body that does not parse as one calendar stays text. The Data Source has no format field.

**The calendar reads as `{ events: [...] }`**, as CSV reads under `data`. Each event is `uid`, `summary`, `description`, `location`, `start`, `end`, `all_day` and `status`, a missing text property `null` and `status` as the feed writes it (`CONFIRMED`, `TENTATIVE`, `CANCELLED`). The list is flat and sorted by `start`. Alarms and the feed's timezone blocks are not shown.

**Recurring events are expanded over a fixed window**: from the start of today in the Instance Time Zone to thirty days later, so the thirty days from today. Every occurrence that overlaps the window is kept. `EXDATE` drops an occurrence and a `RECURRENCE-ID` override replaces it with its own time and text. A Template or transform that wants fewer days narrows the list itself.

**Times are in the Instance Time Zone** (ADR-0009 and its #1445 addendum): `start` and `end` are RFC 3339 with that zone's offset at the time, as `2026-10-21T09:00:00+02:00`. A time in UTC or under an IANA `TZID` is read in that zone. A `TZID` that is not an IANA name, as Outlook writes `Eastern Standard Time`, is read through the feed's own `VTIMEZONE`, and a floating time is read in the Instance Time Zone. An all-day event is its dates, `YYYY-MM-DD`, with `all_day: true`. Its `end` is the day after its last day, as iCalendar and Google Calendar's API have it.

Considered and rejected:

- **A `format` field on the Data Source.** Detection decides every feed seen so far, and a field needs a migration, wire types and a control for a choice the body already states.
- **A configurable window.** One more setting on every Data Source for something a transform can already narrow. Thirty days covers a month view and an agenda.
- **Showing times in each event's own zone.** A Template's date filters already render in the Instance Time Zone; mixed offsets in one list would make `date` disagree with the event.
- **`node-ical`.** `ical.js` is maintained by Mozilla for Thunderbird, ships its own types, and expands recurrences with exclusions and overrides through one iterator.

## Consequences

- `ical.js` joins the API's dependencies. The reading lives in `ics-calendar.ts` beside the fetcher's `response-body.ts`, and the fetcher is given the Instance Time Zone to read with.
- The window moves with the day, so a cached render made before midnight lists yesterday until the Plugin's next refresh.
- A transform gets the parsed events, as it gets XML and CSV parsed. A transform that wants the raw feed fetches it itself.
