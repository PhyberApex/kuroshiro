import { describe, expect, it } from 'vitest'
import { batteryPercentFromVoltage } from '../battery'

describe('batteryPercentFromVoltage', () => {
  it('maps 4.2V and above to 100%', () => {
    expect(batteryPercentFromVoltage('4.2')).toBe(100)
    expect(batteryPercentFromVoltage('4.5')).toBe(100)
  })

  it('maps 3.0V and below to 0%', () => {
    expect(batteryPercentFromVoltage('3.0')).toBe(0)
    expect(batteryPercentFromVoltage('2.5')).toBe(0)
  })

  it('linearly interpolates between 3.0V and 4.2V', () => {
    expect(batteryPercentFromVoltage('3.6')).toBe(50)
  })

  it('returns undefined when no voltage is reported', () => {
    expect(batteryPercentFromVoltage(undefined)).toBeUndefined()
    expect(batteryPercentFromVoltage('')).toBeUndefined()
  })

  it('returns undefined for an unparsable voltage', () => {
    expect(batteryPercentFromVoltage('not-a-number')).toBeUndefined()
  })
})
