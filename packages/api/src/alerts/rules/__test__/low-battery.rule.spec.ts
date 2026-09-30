import { describe, expect, it } from 'vitest'
import { makeDevice } from '../../../test/fixtures.js'
import { lowBatteryRule } from '../low-battery.rule.js'

const NOW = new Date('2026-01-01T12:00:00.000Z')
const context = { now: NOW, lowBatteryPercent: 20, offlineMultiplier: 3, fetchFailureThreshold: 3 }

describe('lowBatteryRule', () => {
  it('opens when the derived percentage is below the threshold', () => {
    const device = makeDevice({ batteryVoltage: '3.2' }) // ~17%
    const evaluation = lowBatteryRule.evaluate(device, context, false)
    expect(evaluation.skip).toBeFalsy()
    expect(evaluation.active).toBe(true)
    expect(evaluation.details).toEqual({ percent: 17 })
  })

  it('does not open when the percentage is at or above the threshold', () => {
    const device = makeDevice({ batteryVoltage: '3.4' }) // 33%
    expect(lowBatteryRule.evaluate(device, context, false).active).toBe(false)
  })

  it('does not resolve an active alert until the percentage clears threshold + hysteresis', () => {
    // 22% is above the 20% open threshold but below the 25% resolve threshold — no flap.
    const device = makeDevice({ batteryVoltage: '3.264' })
    const evaluation = lowBatteryRule.evaluate(device, context, true)
    expect(evaluation.active).toBe(true)
  })

  it('resolves an active alert once the percentage reaches threshold + hysteresis', () => {
    const device = makeDevice({ batteryVoltage: '3.3' }) // 25%
    const evaluation = lowBatteryRule.evaluate(device, context, true)
    expect(evaluation.active).toBe(false)
  })

  it('skips a device with no reported voltage, whether or not an alert is already active', () => {
    const device = makeDevice({ batteryVoltage: undefined })
    expect(lowBatteryRule.evaluate(device, context, false).skip).toBe(true)
    expect(lowBatteryRule.evaluate(device, context, true).skip).toBe(true)
  })

  it('builds the opened and resolved notification content', () => {
    const device = makeDevice({ name: 'Kitchen Display', mac: 'AA:BB:CC:DD:EE:FF' })
    expect(lowBatteryRule.openedNotification(device, { percent: 17 })).toEqual({
      title: 'Kuroshiro: Kitchen Display battery low',
      body: 'Kitchen Display (AA:BB:CC:DD:EE:FF) is at 17%.',
      type: 'warning',
    })
    expect(lowBatteryRule.resolvedNotification(device, { percent: 25 })).toEqual({
      title: 'Kuroshiro: Kitchen Display battery recovered',
      body: 'Kitchen Display (AA:BB:CC:DD:EE:FF) is at 25%.',
      type: 'success',
    })
  })
})
