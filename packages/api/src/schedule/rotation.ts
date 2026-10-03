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
  nextPollAt: Date
  isMirrored: boolean
}

export interface ScreenStateRead {
  state: ScreenState | null
  stateCause: ScreenStateCause | null
}

const NO_STATE: ScreenStateRead = { state: null, stateCause: null }

function isPassedOver(screen: RotationScreen, at: Date): boolean {
  return scheduleExclusion(screen.schedule, at) !== null || screen.renderSignal === 'skip'
}

/**
 * Scans forward in Order from the Active Screen, wrapping past the end, and
 * returns the first Screen Rotation does not pass over at `at`. Scanning from
 * the start of the Order when no Screen is active is what lets a Device that
 * had nothing eligible pick the Rotation back up on a later poll.
 */
export function nextEligibleScreen<T extends RotationScreen>(screensInOrder: T[], at: Date): T | null {
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
    return { state: 'active', stateCause: null }
  const exclusion = scheduleExclusion(screen.schedule, now)
  if (exclusion)
    return exclusion
  return screen.renderSignal === 'skip' ? { state: 'skipping', stateCause: null } : null
}

/**
 * The Screen State of each of a Device's Screens, by Screen id. `upNext` is
 * the Screen Rotation would turn to at the next poll, so no Screen carries it
 * when that is the Active Screen itself.
 */
export function screenStatesOf(screensInOrder: RotationScreen[], moment: RotationMoment): Map<string, ScreenStateRead> {
  if (moment.isMirrored)
    return new Map(screensInOrder.map(screen => [screen.id, NO_STATE]))

  const upNext = nextEligibleScreen(screensInOrder, moment.nextPollAt)
  return new Map(screensInOrder.map((screen) => {
    const state = ownState(screen, moment.now)
      ?? (screen === upNext ? { state: 'upNext' as const, stateCause: null } : NO_STATE)
    return [screen.id, state]
  }))
}
