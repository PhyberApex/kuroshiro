import { cdp } from 'vitest/browser'
import { settled } from './paint'

/** `withCoarsePointer` and `withMotionAllowed` ride the CDP session Playwright opens for Chromium; Firefox has none. */
export const isFirefox = navigator.userAgent.includes('Firefox')

/**
 * Runs `body` as on a touch screen, where `(pointer: coarse)` matches and a control is
 * 44 px high. Pointer events still come from the mouse.
 */
export async function withCoarsePointer<T>(body: () => Promise<T>) {
  await cdp().send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 })
  await settled()
  try {
    return await body()
  }
  finally {
    await cdp().send('Emulation.setTouchEmulationEnabled', { enabled: false })
    await settled()
  }
}

async function emulateMotion(value: 'reduce' | 'no-preference') {
  await cdp().send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value }] })
  await settled()
}

/** Runs `body` with motion allowed. Every other test runs under reduced motion, as `vitest.browser.ts` sets it. */
export async function withMotionAllowed<T>(body: () => Promise<T>) {
  await emulateMotion('no-preference')
  try {
    return await body()
  }
  finally {
    await emulateMotion('reduce')
  }
}
