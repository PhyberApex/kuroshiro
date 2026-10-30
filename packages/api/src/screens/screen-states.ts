import type { RenderSignal } from 'kuroshiro-shared'
import type { Device } from '../devices/devices.entity.js'
import type { ScreenStateRead } from '../schedule/rotation.js'
import type { Screen } from './screens.entity.js'
import { nextRotationAt } from '../devices/next-poll.js'
import { screenStatesOf } from '../schedule/rotation.js'

/**
 * The Render Signal a Screen is gated on before it renders, for Rotation and
 * every read alike: a `plugin` or Mashup Screen's verdict is remembered until
 * its cached output changes, while a raw `html` Screen re-evaluates its Render
 * Signal on every poll it comes up in, so a stale stored `skip` or `hold` never
 * gates it and is not read as its own.
 */
export function renderSignalOf(screen: Screen): RenderSignal | null {
  return screen.type === 'html' ? null : (screen.renderSignal ?? null)
}

/**
 * The Screen State of each of a Device's Screens, by Screen id, for every read
 * that shows one. `screensInOrder` is all of the Device's Screens, each with
 * its Schedule.
 */
export function screenStatesOfDevice(device: Device, screensInOrder: Screen[], now: Date): Map<string, ScreenStateRead> {
  const rotationScreens = screensInOrder.map(screen => ({ id: screen.id, isActive: screen.isActive, schedule: screen.schedule, renderSignal: renderSignalOf(screen) }))
  return screenStatesOf(rotationScreens, { now, nextRotationAt: nextRotationAt(device, now), isMirrored: !!device.mirrorEnabled, pickedScreenId: device.pickedScreen?.id ?? null })
}
