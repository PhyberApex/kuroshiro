export const MIN_SLEEP_REFRESH_RATE = 60
const HOUR_MS = 3_600_000

interface SleepFields {
  sleepModeEnabled: boolean
  sleepStartTime?: number | null
  sleepEndTime?: number | null
}

/**
 * A pure function of the configured window and the server's current local
 * time — no field tracks "currently asleep" (ADR-0012). `sleepEndTime` is
 * exclusive so a Device is no longer asleep the instant its window ends.
 */
export function isDeviceAsleep(device: SleepFields, now: Date): boolean {
  if (!device.sleepModeEnabled || device.sleepStartTime == null || device.sleepEndTime == null)
    return false
  const current = secondsOfDay(now)
  const { sleepStartTime: start, sleepEndTime: end } = device
  return start > end
    ? current >= start || current < end
    : current >= start && current < end
}

/**
 * Elapsed seconds until `nextSleepEnd`, so a night the clock jumps for daylight
 * saving still wakes the Device at the time the UI shows. Rounded up so it never
 * wakes before the window ends, and floored at MIN_SLEEP_REFRESH_RATE so the
 * Device never re-polls at (or before) 0.
 */
export function secondsUntilSleepEnd(sleepEndTime: number, now: Date): number {
  const raw = Math.ceil((nextSleepEnd(sleepEndTime, now).getTime() - now.getTime()) / 1000)
  return Math.max(MIN_SLEEP_REFRESH_RATE, raw)
}

/** The next moment after `now` at which the server's clock reads `sleepEndTime`. */
export function nextSleepEnd(sleepEndTime: number, now: Date): Date {
  const end = new Date(now)
  end.setHours(0, 0, 0, 0)
  end.setSeconds(sleepEndTime)
  if (end > now)
    return end
  // The night clocks fall back reads each time of the repeated hour twice; past the first, the second is next.
  const repeated = new Date(end.getTime() + HOUR_MS)
  if (repeated > now && secondsOfDay(repeated) === secondsOfDay(end))
    return repeated
  end.setDate(end.getDate() + 1)
  return end
}

function secondsOfDay(now: Date): number {
  return now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()
}

/** `hh:mm` for a time of day stored as seconds since midnight. */
export function toClockTime(secondsOfDay: number): string {
  const twoDigits = (value: number) => String(value).padStart(2, '0')
  return `${twoDigits(Math.floor(secondsOfDay / 3600))}:${twoDigits(Math.floor(secondsOfDay % 3600 / 60))}`
}
