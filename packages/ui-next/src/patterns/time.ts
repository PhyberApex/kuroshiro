const MINUTE_MS = 60_000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS

// A Device's or the server's clock may run a little ahead of the browser's.
const CLOCK_SKEW_MS = MINUTE_MS

/** "4 min ago" for a time within the last day; nothing for an older one, which is shown as `exactTime`. */
export function relativeTime(at: Date, now: Date): string | undefined {
  const elapsed = now.getTime() - at.getTime()
  if (elapsed < -CLOCK_SKEW_MS || elapsed >= DAY_MS)
    return undefined
  if (elapsed < MINUTE_MS)
    return 'just now'
  return elapsed < HOUR_MS
    ? `${Math.floor(elapsed / MINUTE_MS)} min ago`
    : `${Math.floor(elapsed / HOUR_MS)} h ago`
}

const EXACT = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
const CLOCK = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

/** "1 Oct 2026, 07:31", in the browser's timezone. */
export function exactTime(at: Date) {
  return EXACT.format(at)
}

/** "07:31", in the browser's timezone: the `{hh:mm}` of a sentence about a poll. */
export function clockTime(at: Date) {
  return CLOCK.format(at)
}
