import { describe, expect, it } from 'vitest'
import { makeDevice } from '../../../test/fixtures.js'
import { offlineRule } from '../offline.rule.js'

// Built via the local-time constructor, like sleep-mode.spec.ts, so the
// Rule's local-time window math is exercised independent of the host's TZ.
function localTime(hh: number, mm: number, ss = 0): Date {
  return new Date(2026, 0, 1, hh, mm, ss)
}

const NOW = localTime(12, 0)

function context(offlineMultiplier = 3) {
  return { now: NOW, lowBatteryPercent: 20, offlineMultiplier, fetchFailureThreshold: 3 }
}

describe('offlineRule', () => {
  it('opens when the device has not polled within refreshRate * multiplier', () => {
    const device = makeDevice({
      refreshRate: 300,
      lastSeen: new Date(NOW.getTime() - 1000 * 1000), // stale by 1000s > 900s threshold
    })
    const evaluation = offlineRule.evaluate(device, context(), false)
    expect(evaluation.skip).toBeFalsy()
    expect(evaluation.active).toBe(true)
  })

  it('does not open while the device is within its allowed staleness window', () => {
    const device = makeDevice({
      refreshRate: 300,
      lastSeen: new Date(NOW.getTime() - 500 * 1000), // 500s < 900s threshold
    })
    expect(offlineRule.evaluate(device, context(), false).active).toBe(false)
  })

  it('has nothing to say about a Device that never polled', () => {
    const device = makeDevice({ refreshRate: 300, lastSeen: null })

    expect(offlineRule.evaluate(device, context(), false)).toEqual({ skip: true, active: false })
  })

  it('resolves once the device has polled again', () => {
    const device = makeDevice({ refreshRate: 300, lastSeen: NOW })
    expect(offlineRule.evaluate(device, context(), true).active).toBe(false)
  })

  it('skips entirely while the device is inside its Sleep Mode window', () => {
    const device = makeDevice({
      refreshRate: 300,
      sleepModeEnabled: true,
      sleepStartTime: 4 * 3600, // 04:00
      sleepEndTime: 14 * 3600, // 14:00 — so noon (12:00) is inside the window
      lastSeen: new Date(NOW.getTime() - 100_000_000),
    })
    const evaluation = offlineRule.evaluate(device, context(), false)
    expect(evaluation.skip).toBe(true)
  })

  it('does not mark a device offline immediately after its sleep window ends, measuring staleness from sleepEndTime instead of the stale lastSeen', () => {
    const device = makeDevice({
      refreshRate: 300,
      sleepModeEnabled: true,
      sleepStartTime: 22 * 3600, // 22:00
      sleepEndTime: 11 * 3600 + 55 * 60, // 11:55 — window ended 5 minutes before "now" (noon)
      lastSeen: new Date(NOW.getTime() - 100_000_000), // long stale, from before sleep
    })
    // 5 minutes (300s) since sleepEndTime, threshold is 300*3=900s — not yet offline.
    expect(offlineRule.evaluate(device, context(), false).active).toBe(false)
  })

  it('marks a device offline once multiplier * refreshRate has elapsed since sleepEndTime', () => {
    const device = makeDevice({
      refreshRate: 300,
      sleepModeEnabled: true,
      sleepStartTime: 22 * 3600,
      sleepEndTime: 11 * 3600, // window ended 1 hour (3600s) before "now"
      lastSeen: new Date(NOW.getTime() - 100_000_000),
    })
    // 3600s since sleepEndTime > 900s threshold
    expect(offlineRule.evaluate(device, context(), false).active).toBe(true)
  })

  it('ignores stale sleepStartTime/sleepEndTime left over from a disabled Sleep Mode', () => {
    // Disabling sleepModeEnabled doesn't clear the window fields (see
    // update-device.dto.ts), so a genuinely-offline Device that used to have
    // Sleep Mode configured must not have its staleness measured from that
    // stale window instead of its real (very stale) lastSeen.
    const device = makeDevice({
      refreshRate: 300,
      sleepModeEnabled: false,
      sleepStartTime: 22 * 3600,
      sleepEndTime: 11 * 3600 + 55 * 60, // would "end" 5 minutes before "now" if Sleep Mode were still on
      lastSeen: new Date(NOW.getTime() - 100_000_000), // long offline
    })
    expect(offlineRule.evaluate(device, context(), false).active).toBe(true)
  })

  it('measures staleness from yesterday\'s window end when the window ended before midnight relative to "now"', () => {
    // "now" is 00:30 — the sleep window (22:00-06:00) is still active, so this
    // exercises the "window end" lookup needing to reach back a day when NOW
    // is itself just past midnight and the *previous* window is still open.
    const now = localTime(0, 30)
    const device = makeDevice({
      refreshRate: 60,
      sleepModeEnabled: true,
      sleepStartTime: 22 * 3600,
      sleepEndTime: 6 * 3600,
      lastSeen: new Date(now.getTime() - 100_000_000),
    })
    expect(offlineRule.evaluate(device, { ...context(), now }, false).skip).toBe(true)
  })

  it('builds the opened and resolved notification content', () => {
    const device = makeDevice({ name: 'Kitchen Display', mac: 'AA:BB:CC:DD:EE:FF' })
    const details = { lastSeen: '2026-01-01T10:00:00.000Z' }
    expect(offlineRule.openedNotification(device, details)).toEqual({
      title: 'Kuroshiro: Kitchen Display is offline',
      body: 'Kitchen Display (AA:BB:CC:DD:EE:FF) was last seen 2026-01-01T10:00:00.000Z.',
      type: 'failure',
    })
    expect(offlineRule.resolvedNotification(device, details)).toEqual({
      title: 'Kuroshiro: Kitchen Display back online',
      body: 'Kitchen Display (AA:BB:CC:DD:EE:FF) was last seen 2026-01-01T10:00:00.000Z.',
      type: 'success',
    })
  })
})
