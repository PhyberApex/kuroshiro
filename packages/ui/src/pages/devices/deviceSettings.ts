import type { DeviceDetail, DeviceModelRead, FirmwareRead, PaletteRead, UpdateDeviceInput } from 'kuroshiro-shared'
import type { SelectOption } from '@/components/selectOption'
import { MAC_ADDRESS_PATTERN, REFRESH_RATE_MAX, REFRESH_RATE_MIN } from 'kuroshiro-shared'
import { nextPollTime } from './currentScreenStory'

export type RateUnit = 'minutes' | 'hours'

const UNIT_SECONDS: Record<RateUnit, number> = { minutes: 60, hours: 3600 }

export const RATE_UNIT_OPTIONS: SelectOption<RateUnit>[] = [
  { value: 'minutes', label: 'minutes' },
  { value: 'hours', label: 'hours' },
]

export const RATE_RANGE_MESSAGE = 'Enter between 1 minute and 24 hours.'

export interface RateEntered {
  amount: number | null
  unit: RateUnit
}

/** A refresh rate as its row shows it: in hours where it is whole hours, in minutes otherwise. */
export function rateShown(seconds: number): RateEntered {
  const unit: RateUnit = seconds % UNIT_SECONDS.hours === 0 ? 'hours' : 'minutes'
  return { amount: seconds / UNIT_SECONDS[unit], unit }
}

/** The seconds an entered refresh rate sends, or nothing for one the server would refuse. */
export function rateSeconds({ amount, unit }: RateEntered) {
  const seconds = amount === null ? Number.NaN : amount * UNIT_SECONDS[unit]
  return Number.isInteger(seconds) && seconds >= REFRESH_RATE_MIN && seconds <= REFRESH_RATE_MAX ? seconds : undefined
}

/** What switching Sleep Mode on the first time saves with it. */
export const FIRST_SLEEP_WINDOW = { start: '23:00', end: '06:00' } as const

/** `HH:MM` as the seconds of day the Device write takes. The read side needs no way back: `SleepState` carries `HH:MM`. */
export function secondsOfDay(time: string) {
  const [hours, minutes] = time.split(':').map(Number)
  return (hours ?? 0) * 3600 + (minutes ?? 0) * 60
}

export function sleepWindowInput({ start, end }: { start?: string, end?: string }): UpdateDeviceInput {
  return {
    ...(start ? { sleepStartTime: secondsOfDay(start) } : {}),
    ...(end ? { sleepEndTime: secondsOfDay(end) } : {}),
  }
}

/** The Device Models a Device can be set to: a deprecated one only while it is the assigned one. */
export function deviceModelOptions(models: DeviceModelRead[], assigned: string | null): SelectOption[] {
  return models
    .filter(model => !model.deprecated || model.name === assigned)
    .map(model => ({ value: model.name, label: `${model.label} · ${model.width} × ${model.height}` }))
}

const paletteLabel = ({ name, kind }: Pick<PaletteRead, 'name' | 'kind'>) => kind === 'custom' ? `${name} · custom` : name

/** The Palettes a Device on `model` can be set to, in the Device Model's order, and the assigned one whatever the Device Model lists. */
export function paletteOptions(model: DeviceModelRead | undefined, palettes: PaletteRead[], assigned: DeviceDetail['palette']): SelectOption[] {
  const offered = (model?.paletteIds ?? []).flatMap(id => palettes.filter(palette => palette.id === id))
  const kept = assigned && !offered.some(palette => palette.id === assigned.id) ? [assigned] : []
  return [...offered, ...kept].map(palette => ({ value: palette.id, label: paletteLabel(palette) }))
}

/** A select option cannot be the empty string, so "None" has a value of its own. */
export const NO_TARGET = 'none'

type FirmwareNamed = Pick<FirmwareRead, 'version' | 'kind' | 'label'>

function firmwareLabel({ version, kind, label }: FirmwareNamed) {
  return [version, kind === 'custom' ? 'custom' : 'official', kind === 'custom' ? label : null].filter(Boolean).join(' · ')
}

/** As the server decides it: a Firmware that names no Device Model fits every one. */
function fits({ compatibleModels }: FirmwareRead, deviceModel: string | null) {
  return compatibleModels.length === 0 || compatibleModels.includes(deviceModel ?? '')
}

interface FirmwareOffered {
  deviceModel: string | null
  target: DeviceDetail['targetFirmware']
  pushPending: boolean
}

/** "None", then the Firmware that fits the Device Model and is not deprecated, and the assigned one whatever it is. */
export function firmwareOptions(firmware: FirmwareRead[], { deviceModel, target, pushPending }: FirmwareOffered): SelectOption[] {
  const offered: (FirmwareNamed & { id: string })[] = firmware.filter(candidate => !candidate.deprecated && fits(candidate, deviceModel))
  const kept = target && !offered.some(candidate => candidate.id === target.id) ? [target] : []
  return [
    { value: NO_TARGET, label: 'None', disabled: pushPending, reason: pushPending ? 'A push is pending' : undefined },
    ...[...offered, ...kept].map(candidate => ({ value: candidate.id, label: firmwareLabel(candidate) })),
  ]
}

export const MIRROR_MAC_MESSAGE = 'Enter a MAC address like A4:CF:12:00:00:00.'

export const isMacAddress = (entered: string) => MAC_ADDRESS_PATTERN.test(entered.trim())

export const asStoredMac = (entered: string) => entered.trim().toUpperCase()

interface MirroringEntered {
  on: boolean
  mac: string
  /** A new API key as typed; empty while the stored one stays. */
  key: string
}

/**
 * What the Mirroring rows send, or nothing. Switched on, nothing is sent until the MAC address is valid and
 * there is an API key, typed or stored; then only what differs from the saved Device. Switched off, the two values are left alone.
 */
export function mirroringInput({ on, mac, key }: MirroringEntered, saved: DeviceDetail['mirror']): UpdateDeviceInput | undefined {
  if (!on)
    return saved.enabled ? { mirrorEnabled: false } : undefined
  if (!isMacAddress(mac) || !(key || saved.apikeySet))
    return undefined
  const input: UpdateDeviceInput = {
    ...(saved.enabled ? {} : { mirrorEnabled: true }),
    ...(asStoredMac(mac) === saved.mac ? {} : { mirrorMac: asStoredMac(mac) }),
    ...(key ? { mirrorApikey: key } : {}),
  }
  return Object.keys(input).length > 0 ? input : undefined
}

const SHOWN_OF_KEY = 4

/** An API key until "Reveal": only its last four characters. */
export function maskedKey(key: string) {
  const shown = key.length > SHOWN_OF_KEY ? key.slice(-SHOWN_OF_KEY) : ''
  return '•'.repeat(key.length - shown.length) + shown
}

export const screensCounted = (count: number) => `${count} ${count === 1 ? 'Screen' : 'Screens'}`

/** "Regenerate now" (ADR-0039): for a Device that is lost, stolen or will not call in again. */
export function regenerateApikeyWording(device: string) {
  return {
    title: `Give ${device} a new API key now?`,
    what: `${device} stops working at once. Its polls are refused until someone holds its button for 15 seconds and sets it up again. To have it reset itself first, use Device Reset with a new API key instead.`,
    lost: 'The current API key, everywhere it is used.',
    stays: `${device}, its Screens, Schedules and Device Log.`,
  }
}

/** The four Special Functions a Device Kuroshiro targets acts on, in the order they are offered. */
export const OFFERED_SPECIAL_FUNCTIONS = [
  { name: 'identify', does: 'Shows the Device\'s identification screen once' },
  { name: 'sleep', does: 'Puts the Device to sleep until its button is pressed' },
  { name: 'add_wifi', does: 'Opens Wi-Fi setup so another network can be added' },
  { name: 'rewind', does: 'Shows the previous Screen again' },
] as const

/** When something pending gets to the Device: "reaches Kitchen around 07:46", without a time once that moment has passed. */
export function reachesDevice(device: Pick<DeviceDetail, 'name' | 'nextPollAt'>, now: Date) {
  const around = nextPollTime(device, now)
  return around ? `reaches ${device.name} around ${around}` : `reaches ${device.name} at its next poll`
}

/** The sections of a Device's Settings, each by the fragment it answers to. */
export const SETTINGS_SECTIONS = {
  display: 'display',
  sleepMode: 'sleep-mode',
  firmware: 'firmware',
  mirroring: 'mirroring',
  identity: 'identity',
  specialFunctions: 'special-functions',
  resetOrDelete: 'reset',
} as const

/** What the selects of a Device's Settings offer, and whether Firmware Auto-Update is on. */
export interface SettingsReference {
  models: DeviceModelRead[]
  palettes: PaletteRead[]
  firmware: FirmwareRead[]
  firmwareAutoUpdate: boolean
}
