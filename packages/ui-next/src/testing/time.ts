import { onTestFinished, vi } from 'vitest'

/**
 * Holds the clock at `at` for the rest of the test, so a relative time ("4 min ago") reads
 * the same on every run. Timers keep running: only `Date` is held.
 */
export function freezeTime(at: string) {
  vi.useFakeTimers({ toFake: ['Date'], now: new Date(at) })
  onTestFinished(() => {
    vi.useRealTimers()
  })
}
