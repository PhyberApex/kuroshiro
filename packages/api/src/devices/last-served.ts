import type { FallbackKind, FallbackReason } from 'kuroshiro-shared'
import type { Device } from './devices.entity.js'
import { imagePathOf } from 'kuroshiro-shared'

export type LastServedKind = 'screen' | 'fallback' | 'mirror' | 'wipe'
export type LastServedFallback = Exclude<FallbackKind, 'welcome'>
export type LastServedReason = Exclude<FallbackReason, 'neverPolled'>

/** What one `/display` poll answered with, before it is written to the Device. */
export interface Served {
  kind: LastServedKind
  screenId: string | null
  fallback: LastServedFallback | null
  reason: LastServedReason | null
}

export const SERVED_MIRROR: Served = { kind: 'mirror', screenId: null, fallback: null, reason: null }

export const SERVED_WIPE: Served = { kind: 'wipe', screenId: null, fallback: null, reason: null }

/** `asleep` marks a Screen that Sleep Mode keeps on the Device instead of one Rotation reached. */
export function servedScreen(screenId: string, reason: 'asleep' | null = null): Served {
  return { kind: 'screen', screenId, fallback: null, reason }
}

export function servedFallback(fallback: LastServedFallback, reason: LastServedReason, screenId: string | null = null): Served {
  return { kind: 'fallback', screenId, fallback, reason }
}

/** The no-screen Fallback Screen: for a Device without Screens, or one whose Screens Rotation all passes over. */
export function servedNoScreen(screenCount: number): Served {
  return servedFallback('noScreen', screenCount > 0 ? 'noneEligible' : 'noScreens')
}

export type LastServedRecord = Required<Pick<Device, 'lastServedAt' | 'lastServedKind' | 'lastServedScreenId' | 'lastServedFallback' | 'lastServedReason' | 'lastServedRefreshRate' | 'lastServedImagePath'>>

export function toLastServedRecord(served: Served, answer: { image_url: string, refresh_rate: number }, servedAt: Date): LastServedRecord {
  return {
    lastServedAt: servedAt,
    lastServedKind: served.kind,
    lastServedScreenId: served.screenId,
    lastServedFallback: served.fallback,
    lastServedReason: served.reason,
    lastServedRefreshRate: answer.refresh_rate,
    lastServedImagePath: imagePathOf(answer.image_url),
  }
}
