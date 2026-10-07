import { describe, expect, it } from 'vitest'
import { settingViolation } from '../setting-violation.js'

describe('settingViolation', () => {
  it('accepts an integer within SETTING_BOUNDS', () => {
    expect(settingViolation('lowBatteryPercent', 50)).toBeNull()
  })

  it('accepts a Retention age of 0, which means "off"', () => {
    expect(settingViolation('alertRetentionDays', 0)).toBeNull()
  })

  it('accepts a valid boolean Setting', () => {
    expect(settingViolation('firmwareAutoUpdate', true)).toBeNull()
  })

  it('names the key, the bound and the value for a numeric Setting below its minimum', () => {
    expect(settingViolation('alertRetentionDays', -5)).toBe('alertRetentionDays must be an integer of at least 0, not -5')
  })

  it('names both bounds for a numeric Setting with a maximum', () => {
    expect(settingViolation('lowBatteryPercent', 101)).toBe('lowBatteryPercent must be an integer of at least 1 and at most 100, not 101')
  })

  it('refuses a numeric Setting below its minimum with no maximum', () => {
    expect(settingViolation('offlineMultiplier', 1)).toBe('offlineMultiplier must be an integer of at least 2, not 1')
  })

  it('refuses a non-integer number', () => {
    expect(settingViolation('fetchFailureThreshold', 1.5)).toBe('fetchFailureThreshold must be an integer of at least 1, not 1.5')
  })

  it('refuses a numeric Setting sent as a string', () => {
    expect(settingViolation('deviceLogRetentionDays', '30')).toBe('deviceLogRetentionDays must be an integer of at least 0, not "30"')
  })

  it('refuses a boolean Setting sent as a non-boolean', () => {
    expect(settingViolation('firmwareAutoUpdate', 'yes')).toBe('firmwareAutoUpdate must be a boolean, not "yes"')
  })
})
