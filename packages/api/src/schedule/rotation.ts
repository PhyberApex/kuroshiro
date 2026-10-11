import type { RenderSignal, ScreenState, ScreenStateCause } from 'kuroshiro-shared'
import type { Schedule } from './schedule.entity.js'
import { scheduleExclusion } from './schedule-eligibility.js'

/** What Rotation looks at on a Screen. */
export interface RotationScreen {
  id: string
  isActive: boolean
  schedule?: Schedule | null
  renderSignal?: RenderSignal | null
}

export interface RotationMoment {
  now: Date
  /** When Rotation next advances: the Device's next poll, or the end of Sleep Mode's window while it is asleep. */
  nextRotationAt: Date
  isMirrored: boolean
  /** The Device's Picked Screen ("Show next"), dropped quietly instead of overriding Order when it has lapsed (ADR-0038). */
  pickedScreenId?: string | null
}

export interface ScreenStateRead {
  state: ScreenState | null
  stateCause: ScreenStateCause | null
  /** Set only with the state `upNext`, when it is there because it is the Device's Picked Screen. */
  picked: boolean
}

const NO_STATE: ScreenStateRead = { state: null, stateCause: null, picked: false }

/** Whether Rotation would pass over this Screen at `at`: its Schedule excludes it, or it carries a remembered `skip` Render Signal. */
export function isPassedOver(screen: RotationScreen, at: Date): boolean {
  return scheduleExclusion(screen.schedule, at) !== null || screen.renderSignal === 'skip'
}

/**
 * The Screen Rotation turns to at `at`: the Device's Picked Screen when one is
 * named and not passed over — overriding Order once, from wherever the
 * Active Screen is (ADR-0038) — else the first Screen in Order, starting
 * after the Active Screen and wrapping past the end, that Rotation does not
 * pass over. A lapsed pick is dropped quietly and falls through to that same
 * scan. Scanning from the start of the Order when no Screen is active is what
 * lets a Device that had nothing eligible pick the Rotation back up on a
 * later poll.
 */
export function nextEligibleScreen<T extends RotationScreen>(screensInOrder: T[], at: Date, pickedScreenId?: string | null): T | null {
  if (pickedScreenId) {
    const picked = screensInOrder.find(screen => screen.id === pickedScreenId)
    if (picked && !isPassedOver(picked, at))
      return picked
  }
  const activeIndex = screensInOrder.findIndex(screen => screen.isActive)
  const startIndex = activeIndex === -1 ? 0 : activeIndex + 1
  for (let offset = 0; offset < screensInOrder.length; offset++) {
    const candidate = screensInOrder[(startIndex + offset) % screensInOrder.length]
    if (!isPassedOver(candidate, at))
      return candidate
  }
  return null
}

function ownState(screen: RotationScreen, now: Date): ScreenStateRead | null {
  if (screen.isActive)
    return { state: 'active', stateCause: null, picked: false }
  const exclusion = scheduleExclusion(screen.schedule, now)
  if (exclusion)
    return { ...exclusion, picked: false }
  return screen.renderSignal === 'skip' ? { state: 'skipping', stateCause: null, picked: false } : null
}

/**
 * The Screen State of each of a Device's Screens, by Screen id. `upNext` is
 * the Screen Rotation would turn to at the next poll, so no Screen carries it
 * when that is the Active Screen itself; it carries `picked` too when it is
 * there because it is the Device's Picked Screen, rather than Order.
 */
export function screenStatesOf(screensInOrder: RotationScreen[], moment: RotationMoment): Map<string, ScreenStateRead> {
  if (moment.isMirrored)
    return new Map(screensInOrder.map(screen => [screen.id, NO_STATE]))

  const upNext = nextEligibleScreen(screensInOrder, moment.nextRotationAt, moment.pickedScreenId)
  return new Map(screensInOrder.map((screen) => {
    const state = ownState(screen, moment.now)
      ?? (screen === upNext ? { state: 'upNext' as const, stateCause: null, picked: !!moment.pickedScreenId && screen.id === moment.pickedScreenId } : NO_STATE)
    return [screen.id, state]
  }))
}
