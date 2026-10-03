import { describe, expect, it } from 'vitest'
import { makeDevice } from '../../test/fixtures.js'
import { nextPollOf, nextRotationAt } from '../next-poll.js'

/** Local wall-clock time, so the Sleep Mode window math holds whatever the host's timezone. */
function localTime(hh: number, mm: number, day = 1): Date {
  return new Date(2026, 2, day, hh, mm, 0)
}

const POLLED_AT = localTime(10, 0)
const polled = { lastSeen: POLLED_AT, lastServedAt: POLLED_AT, lastServedRefreshRate: 300 }

describe('nextPollOf', () => {
  it('is the last poll\'s time plus the refresh rate that poll was given', () => {
    expect(nextPollOf(makeDevice(polled))).toEqual(localTime(10, 5))
  })

  it('is unknown for a Device that never polled', () => {
    expect(nextPollOf(makeDevice({ lastSeen: null }))).toBeNull()
  })
})

describe('nextRotationAt', () => {
  it('is the Device\'s next poll while that is still ahead', () => {
    expect(nextRotationAt(makeDevice(polled), localTime(10, 2))).toEqual(localTime(10, 5))
  })

  it('is now when the next poll has passed', () => {
    expect(nextRotationAt(makeDevice(polled), localTime(11, 0))).toEqual(localTime(11, 0))
  })

  it('is now when the Device never polled', () => {
    expect(nextRotationAt(makeDevice({ lastSeen: null }), localTime(11, 0))).toEqual(localTime(11, 0))
  })

  describe('with Sleep Mode from 23:00 to 06:00', () => {
    const sleeper = { ...polled, sleepModeEnabled: true, sleepStartTime: 23 * 3600, sleepEndTime: 6 * 3600 }

    it('is the end of the window while the Device is asleep, whatever its next poll', () => {
      expect(nextRotationAt(makeDevice(sleeper), localTime(23, 30))).toEqual(localTime(6, 0, 2))
    })

    it('is the next poll again once the window has ended', () => {
      expect(nextRotationAt(makeDevice(sleeper), localTime(10, 2))).toEqual(localTime(10, 5))
    })

    it('ignores the window on a mirrored Device, which Sleep Mode does not apply to', () => {
      expect(nextRotationAt(makeDevice({ ...sleeper, mirrorEnabled: true }), localTime(23, 30))).toEqual(localTime(23, 30))
    })
  })
})
