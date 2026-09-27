import type { Device } from '../../devices/devices.entity.js'
import type { AlertRule } from './alert-rule.js'
import { isDeviceAsleep } from '../../devices/sleep-mode.js'

const MS_PER_SECOND = 1000

/**
 * The most recent moment (at or before `now`) the Device's Sleep Mode window
 * ended, even if that occurrence was yesterday's. `undefined` when Sleep
 * Mode isn't enabled or no window is configured — a Device that previously
 * used Sleep Mode and had it disabled can still carry stale
 * `sleepStartTime`/`sleepEndTime` values (disabling doesn't clear them), so
 * this must gate on `sleepModeEnabled` too, not just the times being set.
 */
function lastSleepWindowEnd(device: Device, now: Date): Date | undefined {
  if (!device.sleepModeEnabled || device.sleepEndTime == null)
    return undefined
  const candidate = new Date(now)
  candidate.setHours(0, 0, 0, 0)
  candidate.setSeconds(device.sleepEndTime)
  return candidate <= now ? candidate : new Date(candidate.getTime() - 24 * 60 * 60 * MS_PER_SECOND)
}

/**
 * `lastSeen`, unless the Device's Sleep Mode window ended more recently — a
 * Device isn't marked offline merely for having slept through its window
 * (ADR brief for issue #1006).
 */
function effectiveLastSeen(device: Device, now: Date): Date {
  const windowEnd = lastSleepWindowEnd(device, now)
  if (!windowEnd || windowEnd <= device.lastSeen)
    return device.lastSeen
  return windowEnd
}

export const offlineRule: AlertRule = {
  kind: 'device-offline',

  evaluate(device, context, hasActiveAlert) {
    if (isDeviceAsleep(device, context.now))
      return { skip: true, active: hasActiveAlert }

    const reference = effectiveLastSeen(device, context.now)
    const staleMs = context.now.getTime() - reference.getTime()
    const thresholdMs = device.refreshRate * context.offlineMultiplier * MS_PER_SECOND
    return { active: staleMs > thresholdMs, details: { lastSeen: device.lastSeen.toISOString() } }
  },

  openedNotification(device, details) {
    return {
      title: `Kuroshiro: ${device.name} is offline`,
      body: `${device.name} (${device.mac}) was last seen ${details.lastSeen}.`,
      type: 'failure',
    }
  },

  resolvedNotification(device, details) {
    return {
      title: `Kuroshiro: ${device.name} back online`,
      body: `${device.name} (${device.mac}) was last seen ${details.lastSeen}.`,
      type: 'success',
    }
  },
}
