import type { Schedule, Screen } from '@/types'
import { describe, expect, it } from 'vitest'
import { scheduleSummary, screenScheduleColor, screenScheduleLabel } from '../schedule'

function schedule(overrides: Partial<Schedule>): Schedule {
  return { id: 'schedule-1', enabled: true, ...overrides }
}

describe('scheduleSummary', () => {
  it('reads as every day when nothing is restricted', () => {
    expect(scheduleSummary(schedule({}))).toBe('Every day')
    expect(scheduleSummary(schedule({ weekdays: [] }))).toBe('Every day')
  })

  it('names the selected weekdays in week order', () => {
    expect(scheduleSummary(schedule({ weekdays: [5, 1, 3] }))).toBe('Mon, Wed, Fri')
  })

  it('spells out the daily time window', () => {
    expect(scheduleSummary(schedule({ startTime: '07:00', endTime: '09:00' }))).toBe('Every day · 07:00–09:00')
  })

  it('drops the seconds Postgres adds to stored times', () => {
    expect(scheduleSummary(schedule({ startTime: '22:00:00', endTime: '02:00:00' }))).toBe('Every day · 22:00–02:00')
  })

  it('spells out the active date range', () => {
    expect(scheduleSummary(schedule({ startDate: '2026-12-01', endDate: '2026-12-25' })))
      .toBe('Every day · 2026-12-01 → 2026-12-25')
  })

  it('combines every configured dimension', () => {
    const full = schedule({ weekdays: [1, 2, 3, 4, 5], startTime: '07:00', endTime: '09:00', startDate: '2026-12-01', endDate: '2026-12-25' })
    expect(scheduleSummary(full)).toBe('Mon, Tue, Wed, Thu, Fri · 07:00–09:00 · 2026-12-01 → 2026-12-25')
  })
})

describe('screenScheduleLabel', () => {
  function screen(schedule: Schedule | null): Screen {
    return { id: 'screen-1', isActive: false, device: 'device-1', fetchManual: false, schedule } as Screen
  }

  it('reads as always for a screen with no schedule', () => {
    expect(screenScheduleLabel(screen(null))).toBe('Always')
    expect(screenScheduleColor(screen(null))).toBe('secondary')
  })

  it('summarises an enabled schedule', () => {
    const enabled = schedule({ weekdays: [1] })
    expect(screenScheduleLabel(screen(enabled))).toBe('Mon')
    expect(screenScheduleColor(screen(enabled))).toBe('success')
  })

  it('marks a disabled schedule while keeping its rules visible', () => {
    const disabled = schedule({ enabled: false, weekdays: [1] })
    expect(screenScheduleLabel(screen(disabled))).toBe('Disabled · Mon')
    expect(screenScheduleColor(screen(disabled))).toBe('warning')
  })
})
