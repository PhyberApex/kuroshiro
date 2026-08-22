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

function secondsOfDay(now: Date): number {
  return now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()
}
