import { onTestFinished, vi } from 'vitest'

const CREEP_EVERY_MS = 10

/**
 * Holds the clock at `at` for the rest of the test, so a relative time ("4 min ago") reads
 * the same on every run. Timers keep running: only `Date` is held.
 *
 * The held clock still creeps on by a millisecond every few real ones. Vue drops an event
 * that is not later than the moment its listener was attached, so on a clock that stood
 * quite still a button with two listeners (`Button`) would never fire.
 */
export function freezeTime(at: string) {
  vi.useFakeTimers({ toFake: ['Date'], now: new Date(at) })
  const creep = setInterval(() => vi.setSystemTime(Date.now() + 1), CREEP_EVERY_MS)
  onTestFinished(() => {
    clearInterval(creep)
    vi.useRealTimers()
  })
}
