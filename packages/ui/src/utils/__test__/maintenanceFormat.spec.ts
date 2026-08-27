import { describe, expect, it } from 'vitest'
import { formatAge, formatBytes } from '../maintenanceFormat'

describe('formatBytes', () => {
  it('formats zero bytes', () => {
    expect(formatBytes(0)).toBe('0 B')
  })

  it('formats bytes below 1024 as B', () => {
    expect(formatBytes(512)).toBe('512 B')
  })

  it('formats kilobytes', () => {
    expect(formatBytes(2048)).toBe('2 KB')
  })

  it('formats megabytes with two decimal places', () => {
    expect(formatBytes(5 * 1024 * 1024 + 123_456)).toBe('5.12 MB')
  })

  it('formats gigabytes', () => {
    expect(formatBytes(3 * 1024 ** 3)).toBe('3 GB')
  })
})

describe('formatAge', () => {
  it('formats sub-day ages in hours', () => {
    expect(formatAge(5)).toBe('5h')
  })

  it('rounds hours', () => {
    expect(formatAge(5.6)).toBe('6h')
  })

  it('formats day-plus ages in whole days', () => {
    expect(formatAge(48)).toBe('2d')
  })

  it('floors partial days', () => {
    expect(formatAge(49)).toBe('2d')
  })
})
