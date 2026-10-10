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

  it('resolves a high threshold at 100% instead of a resolve point above it', () => {
    const highContext = { ...context, lowBatteryPercent: 96 }
    const stillLow = makeDevice({ batteryVoltage: '4.16' }) // 97%
    expect(lowBatteryRule.evaluate(stillLow, highContext, true).active).toBe(true)
    const full = makeDevice({ batteryVoltage: '4.2' }) // 100%
    expect(lowBatteryRule.evaluate(full, highContext, true).active).toBe(false)
  })

  it('resolves a threshold of 100 once the battery reads 100%, which never happened before capping', () => {
    const maxContext = { ...context, lowBatteryPercent: 100 }
    const notQuite = makeDevice({ batteryVoltage: '4.188' }) // 99%
    expect(lowBatteryRule.evaluate(notQuite, maxContext, true).active).toBe(true)
    const full = makeDevice({ batteryVoltage: '4.2' }) // 100%
    expect(lowBatteryRule.evaluate(full, maxContext, true).active).toBe(false)
  })

  it('skips a device with no reported voltage, whether or not an alert is already active', () => {
    const device = makeDevice({ batteryVoltage: undefined })
    expect(lowBatteryRule.evaluate(device, context, false).skip).toBe(true)
    expect(lowBatteryRule.evaluate(device, context, true).skip).toBe(true)
  })

  it('builds the opened and resolved notification content', () => {
    const device = makeDevice({ name: 'Kitchen Display', mac: 'AA:BB:CC:DD:EE:FF', batteryVoltage: '3.12' })
    expect(lowBatteryRule.openedNotification(device)).toEqual({
      title: 'Kuroshiro: Kitchen Display battery low',
      body: 'Kitchen Display (AA:BB:CC:DD:EE:FF) is at 10%.',
      type: 'warning',
    })
    expect(lowBatteryRule.resolvedNotification({ ...device, batteryVoltage: '4.2' })).toEqual({
      title: 'Kuroshiro: Kitchen Display battery recovered',
      body: 'Kitchen Display (AA:BB:CC:DD:EE:FF) is at 100%.',
      type: 'success',
    })
  })
})
