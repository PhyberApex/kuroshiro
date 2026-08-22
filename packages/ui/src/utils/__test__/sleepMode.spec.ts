import { describe, expect, it } from 'vitest'
import { secondsToTimeInput, timeInputToSeconds } from '../sleepMode'

describe('secondsToTimeInput', () => {
  it('formats seconds-since-midnight as HH:MM', () => {
    expect(secondsToTimeInput(22 * 3600)).toBe('22:00')
    expect(secondsToTimeInput(6 * 3600 + 5 * 60)).toBe('06:05')
  })

  it('returns an empty string for null or undefined', () => {
    expect(secondsToTimeInput(null)).toBe('')
    expect(secondsToTimeInput(undefined)).toBe('')
  })
})

describe('timeInputToSeconds', () => {
  it('parses an HH:MM value into seconds-since-midnight', () => {
    expect(timeInputToSeconds('22:00')).toBe(22 * 3600)
    expect(timeInputToSeconds('06:05')).toBe(6 * 3600 + 5 * 60)
  })

  it('returns null for an empty value', () => {
    expect(timeInputToSeconds('')).toBeNull()
  })
})
