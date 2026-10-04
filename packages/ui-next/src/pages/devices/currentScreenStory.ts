import type { AlertSummary, CurrentFallbackScreen, CurrentMirroredScreen, CurrentScreenOfRotation, DeviceDetail, DeviceSummary, FallbackReason, ScreenRead } from 'kuroshiro-shared'
import type { Sentence } from './sentence'
import { clockTime } from '@/patterns/time'
import { deviceSettingsPath } from './devicePaths'
import { possessive, screenName } from './screenNaming'
import { linkTo, mono, sentence, strong } from './sentence'

export type PlateState
  = | 'active'
    | 'asleep'
    | 'asleepKeeping'
    | 'noScreens'
    | 'noneEligible'
    | 'renderFailed'
    | 'mirrored'
    | 'proxied'
    | 'mirrorFailed'
    | 'offline'
    | 'neverPolled'

export interface CurrentScreenStory {
  state: PlateState
  heading: string
  sentences: Sentence[]
  /** The seal: only on the Active Screen's image of a Device that is not offline. */
  sealed: boolean
  /** The id of the Screen whose image the plate shows, which the seal stamps for when it changes. */
  stampKey?: string
}

/** What the story is told from. A Device of the Devices list is enough; without its Screens the sentences leave out the Order and what is up next. */
export interface CurrentScreenTold {
  device: DeviceSummary
  screens: ScreenRead[]
  /** The Alerts firing on this Device. */
  alerts: AlertSummary[]
  now: Date
}

export interface DeviceTold extends CurrentScreenTold {
  device: DeviceDetail
}

type Told<Current> = CurrentScreenTold & { current: Current }

const isOffline = (alerts: AlertSummary[]) => alerts.some(alert => alert.kind === 'device-offline')

const pollOf = (at: string | null) => at ? `the ${clockTime(new Date(at))} poll` : 'its last poll'

/** The `{hh:mm}` of the next poll, or nothing once that moment has passed. */
export function nextPollTime({ nextPollAt }: Pick<DeviceSummary, 'nextPollAt'>, now: Date) {
  const next = nextPollAt ? new Date(nextPollAt) : undefined
  return next && next > now ? clockTime(next) : undefined
}

const upNextOf = (screens: ScreenRead[]) => screens.find(screen => screen.state === 'upNext')

function placeOf(screenId: string, screens: ScreenRead[]) {
  const index = screens.findIndex(screen => screen.id === screenId)
  return index < 0 ? undefined : `Order ${index + 1} of ${screens.length}`
}

function nameOfServed({ current, screens }: Told<CurrentScreenOfRotation>) {
  return screenName(screens.find(screen => screen.id === current.screenId)?.name || current.name)
}

const wakeTime = ({ sleep }: DeviceSummary) => sleep.end ?? 'the end of its window'

function resumeSentence({ device, screens }: CurrentScreenTold) {
  const first = upNextOf(screens) ?? screens.find(screen => screen.state === 'active')
  return first
    ? sentence(`Rotation resumes at ${wakeTime(device)} with `, strong(screenName(first.name)), '.')
    : sentence(`Rotation resumes at ${wakeTime(device)}.`)
}

function keptAsleep(told: Told<CurrentScreenOfRotation>): CurrentScreenStory {
  return {
    state: 'asleepKeeping',
    heading: nameOfServed(told),
    sentences: [
      sentence(`Sleep Mode is in its window until ${wakeTime(told.device)} and keeps this image on the Device.`),
      resumeSentence(told),
    ],
    sealed: false,
    stampKey: told.current.screenId,
  }
}

function lastGiven(told: Told<CurrentScreenOfRotation>): CurrentScreenStory {
  const { device, screens, current } = told
  const place = placeOf(current.screenId, screens)
  const upNext = upNextOf(screens)
  return {
    state: 'offline',
    heading: nameOfServed(told),
    sentences: [
      sentence(`The last image ${device.name} was given${place ? `: ${place}, ` : ', '}at ${pollOf(current.servedAt)}. It has not called in since.`),
      ...upNext ? [sentence('Up next: ', strong(screenName(upNext.name)), `, when ${device.name} calls in again.`)] : [],
    ],
    sealed: false,
    stampKey: current.screenId,
  }
}

function activeScreen(told: Told<CurrentScreenOfRotation>): CurrentScreenStory {
  const { device, screens, current, now } = told
  const place = placeOf(current.screenId, screens)
  const upNext = upNextOf(screens)
  const nextPoll = nextPollTime(device, now)
  return {
    state: 'active',
    heading: nameOfServed(told),
    sentences: [
      sentence(`The Current Screen${place ? `. ${place}, ` : ', '}on the Device since ${pollOf(current.servedAt)}.`),
      upNext
        ? sentence('Up next: ', strong(screenName(upNext.name)), nextPoll ? `, at the poll around ${nextPoll}.` : ', at its next poll.')
        : sentence('No other Screen can be shown right now, so it stays on.'),
    ],
    sealed: true,
    stampKey: current.screenId,
  }
}

function screenOfRotation(told: Told<CurrentScreenOfRotation>) {
  if (told.current.paused)
    return keptAsleep(told)
  return isOffline(told.alerts) ? lastGiven(told) : activeScreen(told)
}

const FALLBACK_STORIES: Record<FallbackReason, (told: Told<CurrentFallbackScreen>) => Omit<CurrentScreenStory, 'sealed'>> = {
  neverPolled: ({ device }) => ({
    state: 'neverPolled',
    heading: `Waiting for ${possessive(device.name)} first poll`,
    sentences: [sentence(`${device.name} is registered and has not called in yet.`)],
  }),
  noScreens: ({ device }) => ({
    state: 'noScreens',
    heading: 'No Screens yet',
    sentences: [sentence(`${device.name} shows the no-screen Fallback Screen until you add one.`)],
  }),
  noneEligible: ({ device }) => ({
    state: 'noneEligible',
    heading: 'No Screen to show',
    sentences: [
      sentence(`Rotation passes over every Screen here right now, so ${device.name} shows the no-screen Fallback Screen.`),
      sentence('Open a Screen below to see why.'),
    ],
  }),
  renderFailed({ device, screens, current }) {
    const name = screenName(screens.find(screen => screen.id === current.screenId)?.name ?? 'The Screen')
    return {
      state: 'renderFailed',
      heading: `${name} could not be shown`,
      sentences: [sentence(`Kuroshiro could not produce ${possessive(name)} image at ${pollOf(current.servedAt)}, so ${device.name} shows the error Fallback Screen. It tries again when the Screen's turn next comes.`)],
    }
  },
  mirrorFailed({ device, current, now }) {
    const nextPoll = nextPollTime(device, now)
    return {
      state: 'mirrorFailed',
      heading: 'Mirroring failed',
      sentences: [
        sentence(`Kuroshiro could not fetch the image from TRMNL at ${pollOf(current.servedAt)}, so ${device.name} shows the error Fallback Screen. It tries again at ${nextPoll ? `the next poll, around ${nextPoll}` : 'its next poll'}.`),
        sentence('Check the mirror MAC address and API key in ', linkTo('Settings', deviceSettingsPath(device.id)), '.'),
      ],
    }
  },
  asleep: told => ({
    state: 'asleep',
    heading: `Asleep until ${wakeTime(told.device)}`,
    sentences: [
      sentence(`Sleep Mode is in its window, so ${told.device.name} shows the sleep Fallback Screen.`),
      resumeSentence(told),
    ],
  }),
}

function mirroredImage({ device, current }: Told<CurrentMirroredScreen>): CurrentScreenStory {
  const fetched = `, fetched at ${pollOf(current.fetchedAt)}.`
  return {
    state: current.proxied ? 'proxied' : 'mirrored',
    heading: 'Mirrored from TRMNL',
    sentences: current.proxied
      ? [
          sentence(`The Current Screen is the image of this same Device on TRMNL's server${fetched}`),
          sentence(`${device.name} is a Proxied Device: TRMNL answers its polls and decides its refresh rate and Firmware.`),
        ]
      : [
          sentence('The Current Screen is the image of the TRMNL Device ', mono(current.mirrorMac), fetched),
          sentence(`${possessive(device.name)} own Screens are kept but not shown.`),
        ],
    sealed: false,
  }
}

/** The plate's state, the heading beside it and its sentences, from what the Device's last poll was answered with. */
export function currentScreenStory(told: CurrentScreenTold): CurrentScreenStory {
  const current = told.device.currentScreen
  if (current.kind === 'screen')
    return screenOfRotation({ ...told, current })
  if (current.kind === 'mirror')
    return mirroredImage({ ...told, current })
  return { ...FALLBACK_STORIES[current.reason]({ ...told, current }), sealed: false }
}
