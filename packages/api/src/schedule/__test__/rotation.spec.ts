import type { RotationScreen } from '../rotation.js'
import type { Schedule } from '../schedule.entity.js'
import { describe, expect, it } from 'vitest'
import { makeSchedule } from '../../test/fixtures.js'
import { nextEligibleScreen, screenStatesOf } from '../rotation.js'

// Moments are written without a zone so they parse as server-local time.
// 2026-08-21 is a Friday, 2026-08-22 a Saturday.
const FRIDAY_NOON = new Date('2026-08-21T12:00:00')
const NEXT_POLL = new Date('2026-08-21T12:05:00')

function screen(id: string, overrides: Partial<RotationScreen> = {}): RotationScreen {
  return { id, isActive: false, schedule: null, renderSignal: null, ...overrides }
}

function scheduled(id: string, schedule: Partial<Schedule>, overrides: Partial<RotationScreen> = {}): RotationScreen {
  return screen(id, { schedule: makeSchedule(schedule), ...overrides })
}

function statesOf(screens: RotationScreen[], moment: { now?: Date, nextPollAt?: Date, isMirrored?: boolean } = {}) {
  const now = moment.now ?? FRIDAY_NOON
  const states = screenStatesOf(screens, { now, nextRotationAt: moment.nextPollAt ?? NEXT_POLL, isMirrored: moment.isMirrored ?? false })
  return Object.fromEntries(screens.map(({ id }) => [id, states.get(id)]))
}

const NO_STATE = { state: null, stateCause: null }

describe('nextEligibleScreen', () => {
  it('is the first eligible Screen after the Active Screen, wrapping past the end of the Order', () => {
    const screens = [screen('a'), scheduled('b', { enabled: false }), screen('c', { isActive: true })]

    expect(nextEligibleScreen(screens, FRIDAY_NOON)?.id).toBe('a')
  })

  it('starts from the top of the Order when no Screen is active', () => {
    expect(nextEligibleScreen([scheduled('a', { enabled: false }), screen('b')], FRIDAY_NOON)?.id).toBe('b')
  })

  it('is the Active Screen itself when no other Screen is eligible', () => {
    expect(nextEligibleScreen([screen('a', { isActive: true }), scheduled('b', { enabled: false })], FRIDAY_NOON)?.id).toBe('a')
  })

  it('is none when every Screen is passed over', () => {
    expect(nextEligibleScreen([scheduled('a', { enabled: false })], FRIDAY_NOON)).toBeNull()
  })

  it('passes over a Screen with a remembered skip Render Signal, and not one with hold', () => {
    const screens = [screen('a', { isActive: true }), screen('b', { renderSignal: 'skip' }), screen('c', { renderSignal: 'hold' })]

    expect(nextEligibleScreen(screens, FRIDAY_NOON)?.id).toBe('c')
  })
})

describe('screenStatesOf', () => {
  describe('each Screen State', () => {
    it('reads the Active Screen as active, the Screen Rotation turns to next as upNext, and one waiting its turn as none', () => {
      expect(statesOf([screen('a', { isActive: true }), screen('b'), screen('c')])).toEqual({
        a: { state: 'active', stateCause: null },
        b: { state: 'upNext', stateCause: null },
        c: NO_STATE,
      })
    })

    it('reads a Screen whose Schedule is switched off as scheduleOff, whatever its days and hours', () => {
      const off = scheduled('a', { enabled: false, weekdays: [6], startTime: '00:00:00', endTime: '01:00:00' })

      expect(statesOf([off]).a).toEqual({ state: 'scheduleOff', stateCause: null })
    })

    it('reads a Screen whose Schedule leaves out today\'s weekday as notToday by weekday', () => {
      expect(statesOf([scheduled('a', { weekdays: [6, 0] })]).a).toEqual({ state: 'notToday', stateCause: 'weekday' })
    })

    it('reads a Screen whose Schedule\'s dates leave out today as notToday by date range', () => {
      const summerOnly = scheduled('a', { startDate: '2026-06-01', endDate: '2026-08-20' })

      expect(statesOf([summerOnly]).a).toEqual({ state: 'notToday', stateCause: 'dateRange' })
    })

    it('names the weekday when both the weekday and the date range leave out today', () => {
      const both = scheduled('a', { weekdays: [6], startDate: '2026-06-01', endDate: '2026-08-20' })

      expect(statesOf([both]).a).toEqual({ state: 'notToday', stateCause: 'weekday' })
    })

    it('reads a Screen outside its hours on a day that matches as notThisHour', () => {
      const mornings = scheduled('a', { weekdays: [5], startTime: '06:00:00', endTime: '09:00:00' })

      expect(statesOf([mornings]).a).toEqual({ state: 'notThisHour', stateCause: null })
    })

    it('reads a Screen with a remembered skip Render Signal as skipping', () => {
      expect(statesOf([screen('a', { renderSignal: 'skip' })]).a).toEqual({ state: 'skipping', stateCause: null })
    })

    it('gives a Screen with a hold Render Signal the state it would have without it', () => {
      expect(statesOf([screen('a', { isActive: true }), screen('b', { renderSignal: 'hold' })]).b).toEqual({ state: 'upNext', stateCause: null })
    })
  })

  describe('a window that crosses midnight', () => {
    const overnight = scheduled('a', { startTime: '22:00:00', endTime: '02:00:00' })

    it.each(['2026-08-21T23:30:00', '2026-08-22T01:30:00'])('lets the Screen show at %s', (moment) => {
      expect(statesOf([overnight], { now: new Date(moment), nextPollAt: new Date(moment) }).a).toEqual({ state: 'upNext', stateCause: null })
    })

    it('reads notThisHour between its end and its start', () => {
      expect(statesOf([overnight]).a).toEqual({ state: 'notThisHour', stateCause: null })
    })
  })

  describe('the precedence', () => {
    it('keeps the Active Screen active after its Schedule closed', () => {
      const closed = scheduled('a', { enabled: false }, { isActive: true })

      expect(statesOf([closed]).a).toEqual({ state: 'active', stateCause: null })
    })

    it.each<[string, Partial<Schedule>, string | null]>([
      ['scheduleOff', { enabled: false }, null],
      ['notToday', { weekdays: [6] }, 'weekday'],
      ['notThisHour', { startTime: '06:00:00', endTime: '09:00:00' }, null],
    ])('puts %s before skipping', (state, schedule, stateCause) => {
      expect(statesOf([scheduled('a', schedule, { renderSignal: 'skip' })]).a).toEqual({ state, stateCause })
    })

    it('puts scheduleOff before the days and hours, and the day before the hour', () => {
      const offAndWrongDay = scheduled('a', { enabled: false, weekdays: [6] })
      const wrongDayAndHour = scheduled('b', { weekdays: [6], startTime: '06:00:00', endTime: '09:00:00' })

      expect(statesOf([offAndWrongDay, wrongDayAndHour])).toEqual({
        a: { state: 'scheduleOff', stateCause: null },
        b: { state: 'notToday', stateCause: 'weekday' },
      })
    })
  })

  describe('upNext', () => {
    it('is the next eligible Screen in Order, past the ones Rotation passes over', () => {
      const screens = [screen('a', { isActive: true }), scheduled('b', { enabled: false }), screen('c'), screen('d')]

      expect(statesOf(screens)).toMatchObject({ b: { state: 'scheduleOff' }, c: { state: 'upNext' }, d: NO_STATE })
    })

    it('wraps to the top of the Order after the last Screen', () => {
      expect(statesOf([screen('a'), screen('b'), screen('c', { isActive: true })])).toMatchObject({ a: { state: 'upNext' }, b: NO_STATE })
    })

    it('is the first eligible Screen when no Screen is active', () => {
      expect(statesOf([scheduled('a', { enabled: false }), screen('b'), screen('c')])).toMatchObject({ b: { state: 'upNext' }, c: NO_STATE })
    })

    it('is no Screen when only the Active Screen is eligible', () => {
      const screens = [screen('a', { isActive: true }), scheduled('b', { enabled: false }), screen('c', { renderSignal: 'skip' })]

      expect(Object.values(statesOf(screens)).map(read => read?.state)).toEqual(['active', 'scheduleOff', 'skipping'])
    })

    it('passes over a Screen with a remembered skip', () => {
      const screens = [screen('a', { isActive: true }), screen('b', { renderSignal: 'skip' }), screen('c')]

      expect(statesOf(screens)).toMatchObject({ b: { state: 'skipping' }, c: { state: 'upNext' } })
    })

    it('is worked out at the next poll, so a Screen whose hours end before it is not upNext', () => {
      const untilNoon = scheduled('b', { startTime: '06:00:00', endTime: '12:02:00' })
      const screens = [screen('a', { isActive: true }), untilNoon, screen('c')]

      expect(statesOf(screens)).toEqual({ a: { state: 'active', stateCause: null }, b: NO_STATE, c: { state: 'upNext', stateCause: null } })
    })

    it('is worked out at the end of Sleep Mode\'s window while the Device is asleep', () => {
      const night = new Date('2026-08-21T23:30:00')
      const wake = new Date('2026-08-22T06:00:00')
      const fridayOnly = scheduled('b', { weekdays: [5] })
      const screens = [screen('a', { isActive: true }), fridayOnly, screen('c')]

      expect(statesOf(screens, { now: night, nextPollAt: wake })).toMatchObject({ b: NO_STATE, c: { state: 'upNext' } })
    })
  })

  it('reads every Screen of a mirrored Device without a state', () => {
    const screens = [screen('a', { isActive: true }), scheduled('b', { enabled: false }), screen('c', { renderSignal: 'skip' }), screen('d')]

    expect(statesOf(screens, { isMirrored: true })).toEqual({ a: NO_STATE, b: NO_STATE, c: NO_STATE, d: NO_STATE })
  })
})
