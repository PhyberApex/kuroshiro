import type { CurrentScreen, DeviceDetail, FallbackKind, ScreenRead, SensorReading } from 'kuroshiro-shared'
import type { DisplayAnswer } from '@/api/deviceCalls'
import type { Sentence, SentencePart } from '@/pages/devices/sentence'
import { possessive, screenName } from '@/pages/devices/screenNaming'
import { sentence, strong } from '@/pages/devices/sentence'
import { listed } from '@/patterns/listed'

/** The six inputs of "What it reports", as typed. */
export interface Report {
  batteryVoltage: string
  rssi: string
  firmwareVersion: string
  model: string
  width: string
  height: string
}

/** Each input of "What it reports" with its label and the header it is sent as. */
export const REPORT_INPUTS: { key: keyof Report, label: string, header: string }[] = [
  { key: 'batteryVoltage', label: 'Battery voltage', header: 'Battery-Voltage' },
  { key: 'rssi', label: 'Signal, dBm', header: 'RSSI' },
  { key: 'firmwareVersion', label: 'Firmware version', header: 'FW-Version' },
  { key: 'model', label: 'Model', header: 'Model' },
  { key: 'width', label: 'Width', header: 'Width' },
  { key: 'height', label: 'Height', header: 'Height' },
]

/** What a simulated Device that is not registered reports: a TRMNL OG on a full battery. */
export const NEW_DEVICE_REPORT: Report = {
  batteryVoltage: '4.10',
  rssi: '-60',
  firmwareVersion: '1.7.8',
  model: 'og',
  width: '800',
  height: '480',
}

export function reportOf({ reported }: DeviceDetail): Report {
  return {
    batteryVoltage: reported.batteryVoltage ?? '',
    rssi: reported.rssi ?? '',
    firmwareVersion: reported.firmwareVersion ?? '',
    model: reported.model ?? '',
    width: reported.width?.toString() ?? '',
    height: reported.height?.toString() ?? '',
  }
}

/** The headers a poll sends for what is filled in. An empty input sends nothing, as a Device that does not report it. */
export function reportHeaders(report: Report): Record<string, string> {
  return Object.fromEntries(REPORT_INPUTS
    .map(({ key, header }) => [header, report[key].trim()])
    .filter(([, value]) => value !== ''))
}

/**
 * The `Sensors` header as the firmware sends it. A poll without it removes every Sensor reading the
 * Device has, so a simulated poll sends back what the Device last reported.
 */
export function sensorsHeader(sensors: SensorReading[]) {
  return sensors.length > 0
    ? sensors.map(({ kind, value, unit }) => `kind=${kind};value=${value};unit=${unit}`).join(',')
    : undefined
}

function pendingNames({ pending, targetFirmware }: DeviceDetail) {
  return [
    ...pending.firmwarePush ? [`Firmware push${targetFirmware ? ` of ${targetFirmware.version}` : ''}`] : [],
    ...pending.deviceReset ? ['Device Reset'] : [],
    ...pending.specialFunction ? [`Special Function ${pending.specialFunction}`] : [],
  ]
}

/** What a poll takes from the Device, each with its article: "the Firmware push of 1.8.0". */
export function pendingTaken(device: DeviceDetail) {
  return pendingNames(device).map(name => `the ${name}`)
}

/** The confirmation's "Lost". */
export function pendingLost(device: DeviceDetail) {
  const names = pendingNames(device)
  const it = names.length > 1 ? 'them' : 'it'
  return `The pending ${listed(names)}. The simulator takes ${it} and the Device never gets ${it}.`
}

function rotationClause(device: DeviceDetail) {
  if (device.isMirrored)
    return `It fetches ${possessive(device.name)} image from TRMNL again`
  if (device.sleep.inWindow)
    return `It leaves ${possessive(device.name)} Rotation where it is while Sleep Mode is in its window`
  return `It moves ${possessive(device.name)} Rotation on by one Screen`
}

function takenParts(taken: string[]): SentencePart[] {
  if (taken.length === 0)
    return [{ text: 'any pending Special Function, Device Reset or Firmware push, which then never reaches the Device.' }]
  const names = taken.flatMap((name, index) => [
    ...index === 0 ? [] : [{ text: index === taken.length - 1 ? ' and ' : ', ' }],
    strong(name),
  ])
  return [...names, { text: `, which then never ${taken.length > 1 ? 'reach' : 'reaches'} the Device.` }]
}

/** What a call does, always in view beside the buttons. Without a Device, it is setup for one that is not registered. */
export function callConsequence(device: DeviceDetail | undefined): Sentence {
  if (!device)
    return sentence(strong('Setup here is a real setup.'), ' It registers a Device with this MAC address, and a poll gives it the welcome Fallback Screen.')
  return sentence(
    strong('A poll here is a real poll.'),
    ` ${rotationClause(device)}, counts as ${device.name} having been seen, and takes `,
    ...takenParts(pendingTaken(device)),
  )
}

const FALLBACK_NAMES: Record<FallbackKind, string> = {
  welcome: 'welcome',
  noScreen: 'no-screen',
  error: 'error',
  sleep: 'sleep',
}

/** "Shows": the Screen with its place in the Order, which Fallback Screen, or where a mirrored image comes from. */
export function showsOf({ currentScreen }: { currentScreen: CurrentScreen }, screens: ScreenRead[]) {
  if (currentScreen.kind === 'fallback')
    return `The ${FALLBACK_NAMES[currentScreen.fallback]} Fallback Screen`
  if (currentScreen.kind === 'mirror')
    return currentScreen.proxied ? 'This Device\'s own image on TRMNL' : `The image of the TRMNL Device ${currentScreen.mirrorMac}`
  const index = screens.findIndex(screen => screen.id === currentScreen.screenId)
  const name = screenName(screens[index]?.name ?? currentScreen.name)
  return index < 0 ? name : `${name}, Order ${index + 1} of ${screens.length}`
}

const SECONDS_PER_MINUTE = 60

function pollsAgainIn(seconds: number) {
  return seconds < SECONDS_PER_MINUTE ? `${seconds} s` : `${Math.round(seconds / SECONDS_PER_MINUTE)} min`
}

function firmwareTold(answer: DisplayAnswer, version: string | null) {
  if (!answer.update_firmware)
    return 'no update'
  return version ? `told to update to ${version}` : `told to update, from ${answer.firmware_url}`
}

export interface AnswerRow {
  label: string
  value: string
}

/** The rows under "Shows": what the answer tells the Device. `version` is the Firmware a push was for, when the page knows it. */
export function answerRows(answer: DisplayAnswer, version: string | null): AnswerRow[] {
  return [
    { label: 'Polls again in', value: pollsAgainIn(answer.refresh_rate) },
    { label: 'Firmware', value: firmwareTold(answer, version) },
    { label: 'Special Function', value: answer.special_function === 'none' ? 'none pending' : answer.special_function },
    ...answer.reset_firmware ? [{ label: 'Device Reset', value: 'told to reset' }] : [],
  ]
}
