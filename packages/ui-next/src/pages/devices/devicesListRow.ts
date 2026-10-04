import type { CurrentScreenStory, CurrentScreenTold, PlateState } from './currentScreenStory'
import type { Sentence } from './sentence'
import { DEVICE_ALERT_LABELS } from './deviceFacts'
import { sentence, strong } from './sentence'

/** The states in which the story's heading is the name of the Screen whose image is on the Device. */
const SHOWS_A_SCREEN: PlateState[] = ['active', 'offline']

/** The line of a Devices list row that says what the Device shows: "Showing {Screen}", or the heading the Screens view gives the state. */
export function whatItShows({ state, heading }: CurrentScreenStory): Sentence {
  return SHOWS_A_SCREEN.includes(state) ? sentence('Showing ', strong(heading)) : sentence(strong(heading))
}

const ALERTS_IN_ROW_ORDER = ['device-offline', 'device-low-battery'] as const

export type RowFact
  = | { kind: 'alert', text: string }
    | { kind: 'lastSeen', at: string }
    | { kind: 'words', text: string }

/** The facts of a Devices list row, the firing Alerts first. A Device that never polled has nothing to report but that. */
export function rowFacts({ device, alerts }: Pick<CurrentScreenTold, 'device' | 'alerts'>): RowFact[] {
  const firing = ALERTS_IN_ROW_ORDER
    .filter(kind => alerts.some(alert => alert.kind === kind))
    .map((kind): RowFact => ({ kind: 'alert', text: DEVICE_ALERT_LABELS[kind] }))
  if (device.lastSeenAt === null)
    return [...firing, { kind: 'words', text: 'Has not called in yet' }]
  return [
    ...firing,
    { kind: 'lastSeen', at: device.lastSeenAt },
    ...device.batteryPercent === null ? [] : [{ kind: 'words' as const, text: `Battery ${device.batteryPercent} %` }],
  ]
}
