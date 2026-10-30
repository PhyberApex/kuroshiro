import type { DeviceDetail, ScheduleRead, ScreenRead, ScreenState } from 'kuroshiro-shared'
import { isPassedOver, SCREEN_STATE_LABELS } from '@/components/screenRows'
import { clockTime } from '@/patterns/time'
import { nextPollTime } from './currentScreenStory'
import { crossesMidnight, dateInZone } from './scheduleEditing'
import { scheduleHours } from './scheduleSummary'
import { screenName } from './screenNaming'

export interface ScreenStateWords {
  /** The Screen State as the row words it; empty for a Screen that waits its turn. */
  words: string
  /** What follows the state in `ink-soft`: "holding image". */
  qualifier?: string
}

function wordsOfTurn(state: 'active' | 'upNext', { sleep }: DeviceDetail) {
  if (!sleep.inWindow)
    return SCREEN_STATE_LABELS[state]
  return state === 'active' ? 'Active Screen, paused' : `Up next at ${sleep.end}`
}

/** A row's Screen State with its qualifiers: paused during Sleep Mode's window, the Picked Screen, and the `hold` Render Signal. */
export function screenStateWords({ state, renderSignal, picked }: Pick<ScreenRead, 'state' | 'renderSignal' | 'picked'>, device: DeviceDetail): ScreenStateWords {
  if (device.isMirrored)
    return { words: '', qualifier: undefined }
  const holding = renderSignal === 'hold'
  if (state === 'active' || state === 'upNext') {
    const qualifiers = [
      state === 'upNext' && picked ? 'picked by hand' : undefined,
      holding ? 'holding image' : undefined,
    ].filter((qualifier): qualifier is string => qualifier !== undefined)
    return { words: wordsOfTurn(state, device), qualifier: qualifiers.length > 0 ? qualifiers.join(' · ') : undefined }
  }
  if (state === null)
    return { words: holding ? 'Holding image' : '', qualifier: undefined }
  return { words: SCREEN_STATE_LABELS[state], qualifier: undefined }
}

export interface ScreenAsked {
  screen: ScreenRead
  /** The Device's Screens in Order. */
  screens: ScreenRead[]
  device: DeviceDetail
  now: Date
  /** The server's timezone, which a Schedule's days and hours are in. */
  timezone: string | undefined
}

const dayAndMonth = (date: string) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`))

function datesOf({ startDate, endDate }: ScheduleRead) {
  if (startDate && endDate)
    return `from ${dayAndMonth(startDate)} to ${dayAndMonth(endDate)}`
  return startDate ? `from ${dayAndMonth(startDate)}` : `until ${dayAndMonth(endDate ?? '')}`
}

const timeInZone = (now: Date, timezone: string | undefined) => new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: timezone }).format(now)

const weekdayInZone = (day: Date, timezone: string | undefined) => new Intl.DateTimeFormat('en-GB', { weekday: 'long', timeZone: timezone }).format(day)

/**
 * The night before `now`, while `now` is in the part of a Schedule's hours after midnight: the API holds such hours to the
 * day they start on. Two hours before that midnight, so a change of clocks overnight cannot land it back on today.
 */
function nightTheHoursBegan({ startTime, endTime }: ScheduleRead, now: Date, timezone: string | undefined) {
  if (!startTime || !endTime || !crossesMidnight(startTime, endTime))
    return undefined
  const time = timeInZone(now, timezone)
  if (time > endTime.slice(0, 'HH:MM'.length))
    return undefined
  const [hours, minutes] = time.split(':').map(Number)
  return new Date(now.getTime() - ((hours! + 2) * 60 + minutes!) * 60_000)
}

function notToday({ screen, now, timezone }: ScreenAsked) {
  const night = screen.schedule && nightTheHoursBegan(screen.schedule, now, timezone)
  if (screen.stateCause === 'dateRange' && screen.schedule) {
    const started = night ? `Its hours from the night of ${dayAndMonth(dateInZone(night, timezone))} run past midnight, and its` : 'Its'
    return `${started} Schedule only runs ${datesOf(screen.schedule)}, so Rotation passes over it.`
  }
  if (night) {
    const weekday = weekdayInZone(night, timezone)
    return `Its hours from ${weekday} night run past midnight, and its Schedule leaves out ${weekday}s, so Rotation passes over it.`
  }
  return `Its Schedule leaves out ${weekdayInZone(now, timezone)}s, so Rotation passes over it today.`
}

function notThisHour({ screen, now, timezone }: ScreenAsked) {
  const serverTime = timeInZone(now, timezone)
  return `Its Schedule runs ${screen.schedule ? scheduleHours(screen.schedule) : 'at other hours'} and it is ${serverTime}, so Rotation passes over it.`
}

function active({ screen, device }: ScreenAsked) {
  if (device.sleep.inWindow)
    return `On hold while ${device.name} is in Sleep Mode.`
  const { currentScreen } = device
  const servedAt = currentScreen.kind === 'screen' && currentScreen.screenId === screen.id ? currentScreen.servedAt : device.lastSeenAt
  return servedAt ? `On the Device since the ${clockTime(new Date(servedAt))} poll.` : 'On the Device.'
}

function upNext({ screen, device, now }: ScreenAsked) {
  const nextPoll = nextPollTime(device, now)
  if (screen.picked) {
    return nextPoll
      ? `Picked by hand: shows at the next poll, around ${nextPoll}. Rotation then carries on in Order from it.`
      : 'Picked by hand: shows at its next poll. Rotation then carries on in Order from it.'
  }
  return nextPoll ? `Shows at the next poll, around ${nextPoll}.` : 'Shows at its next poll.'
}

/** The Screen whose turn comes before this one's: the nearest before it in Order, around the end, that Rotation does not pass over. */
function waiting({ screen, screens }: ScreenAsked) {
  const own = screens.findIndex(other => other.id === screen.id)
  const before = [...screens.slice(0, own).reverse(), ...screens.slice(own + 1).reverse()].find(other => !isPassedOver(other.state))
  return before ? `Waiting its turn. It comes after ${screenName(before.name)}.` : 'Waiting its turn.'
}

const WHY: Record<ScreenState, (asked: ScreenAsked) => string> = {
  active,
  upNext,
  scheduleOff: () => 'Its Schedule is switched off, so Rotation passes over it. The days and hours are kept.',
  notToday,
  notThisHour,
  skipping: () => 'Skipping: this Screen\'s own content asked to be left out of Rotation for now. It returns by itself when the content changes.',
}

const ALSO_SKIPPING = 'It is also skipping: its own content asked to be left out of Rotation.'
const HOLDING_IMAGE = 'Holding image: its own content asked to keep the previous image, so nothing new is rendered for it.'

/** The sentences an opened row starts with: why the Screen is or is not showing, then what its Render Signal adds. */
export function screenWhy(asked: ScreenAsked): string[] {
  const { screen, device } = asked
  if (device.isMirrored)
    return ['Kept while Mirroring is on. It takes its place in Rotation again when Mirroring is switched off.']
  return [
    screen.state ? WHY[screen.state](asked) : waiting(asked),
    ...screen.renderSignal === 'skip' && screen.state !== 'skipping' ? [ALSO_SKIPPING] : [],
    ...screen.renderSignal === 'hold' ? [HOLDING_IMAGE] : [],
  ]
}
