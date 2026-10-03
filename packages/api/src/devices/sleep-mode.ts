const DAY_SECONDS = 86400
export const MIN_SLEEP_REFRESH_RATE = 60

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
 * Seconds until `sleepEndTime`, wrapping past midnight, floored at
 * MIN_SLEEP_REFRESH_RATE so the Device never re-polls at (or before) 0.
 */
export function secondsUntilSleepEnd(sleepEndTime: number, now: Date): number {
  const current = secondsOfDay(now)
  const raw = sleepEndTime > current ? sleepEndTime - current : DAY_SECONDS - current + sleepEndTime
  return Math.max(MIN_SLEEP_REFRESH_RATE, raw)
}

/** The next moment after `now` at which the server's clock reads `sleepEndTime`. */
export function nextSleepEnd(sleepEndTime: number, now: Date): Date {
  const end = new Date(now)
  end.setHours(0, 0, 0, 0)
  end.setSeconds(sleepEndTime)
  if (end <= now)
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
