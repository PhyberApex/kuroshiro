import { Injectable } from '@nestjs/common'

/** Seconds the IANA zone `timeZone` is ahead of UTC at `at` (positive east of UTC), so it follows daylight saving. */
export function utcOffsetSeconds(timeZone: string, at: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  }).formatToParts(at)
  const part = (type: string) => Number(parts.find(candidate => candidate.type === type)!.value)
  const wallClockAsUtc = Date.UTC(part('year'), part('month') - 1, part('day'), part('hour'), part('minute'), part('second'))
  return Math.round((wallClockAsUtc - Math.floor(at.getTime() / 1000) * 1000) / 1000)
}

/**
 * The Instance Time Zone: the one IANA zone the server process runs in (`TZ` in the container sets it), which Schedule,
 * Sleep Mode and every Template render use. Read once at boot; an invalid `TZ` makes `Intl` throw here. The one place a
 * later per-Instance or per-Device zone Setting would feed.
 */
@Injectable()
export class InstanceTimeZone {
  readonly name: string = new Intl.DateTimeFormat().resolvedOptions().timeZone

  /** Seconds the zone is ahead of UTC at `at` (positive east of UTC), so it follows daylight saving. */
  utcOffsetSeconds(at: Date = new Date()): number {
    return utcOffsetSeconds(this.name, at)
  }
}
