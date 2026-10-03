import type { Device } from './devices.entity.js'
import { isDeviceAsleep, nextSleepEnd } from './sleep-mode.js'

const MS_PER_SECOND = 1000

type PollFields = Pick<Device, 'lastSeen' | 'lastServedAt' | 'lastServedRefreshRate'>
type RotationFields = PollFields & Pick<Device, 'mirrorEnabled' | 'sleepModeEnabled' | 'sleepStartTime' | 'sleepEndTime'>

/** The last poll's time plus the refresh rate that poll was given; `null` before the first poll. */
export function nextPollOf(device: PollFields): Date | null {
  if (!device.lastSeen || !device.lastServedAt || device.lastServedRefreshRate == null)
    return null
  return new Date(device.lastServedAt.getTime() + device.lastServedRefreshRate * MS_PER_SECOND)
}

/**
 * When Rotation next advances on the Device: the end of Sleep Mode's window
 * while it is asleep, else its next poll, else `now` when that poll is overdue
 * or the Device never polled.
 */
export function nextRotationAt(device: RotationFields, now: Date): Date {
  if (!device.mirrorEnabled && isDeviceAsleep(device, now))
    return nextSleepEnd(device.sleepEndTime!, now)
  const nextPoll = nextPollOf(device)
  return nextPoll && nextPoll > now ? nextPoll : now
}
