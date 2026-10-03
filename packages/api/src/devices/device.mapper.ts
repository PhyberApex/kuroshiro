import type { CurrentScreen, DeviceDetail, DeviceSummary, FallbackKind, FallbackReason, SensorReading, SleepState, SpecialFunction } from 'kuroshiro-shared'
import type { Screen } from '../screens/screens.entity.js'
import type { Device } from './devices.entity.js'
import { batteryPercentFromVoltage, SPECIAL_FUNCTIONS } from 'kuroshiro-shared'
import { toImagePath, toIsoString, toIsoStringOrNull } from '../utils/readModel.js'
import { nextPollOf } from './next-poll.js'
import { isDeviceAsleep, nextSleepEnd } from './sleep-mode.js'

const WELCOME_IMAGE_PATH = '/screens/welcome.png'

export interface DeviceSummaryFacts {
  now: Date
  /** The Screen the last-served record names, when it still exists. */
  servedScreen: Pick<Screen, 'id' | 'filename' | 'generatedAt'> | null
}

export interface DeviceDetailFacts extends DeviceSummaryFacts {
  sensors: SensorReading[]
  screenCount: number
}

const WAITING_FOR_FIRST_POLL: CurrentScreen = {
  kind: 'fallback',
  fallback: 'welcome',
  reason: 'neverPolled',
  screenId: null,
  imagePath: WELCOME_IMAGE_PATH,
  servedAt: null,
}

function isProxied(device: Device): boolean {
  return !!device.mirrorEnabled && device.mirrorMac === device.mac
}

interface ServedImage {
  at: Date
  path: string
}

function servedImageOf(device: Device): ServedImage | null {
  return device.lastSeen && device.lastServedAt && device.lastServedImagePath
    ? { at: device.lastServedAt, path: device.lastServedImagePath }
    : null
}

function toMirroredScreen(device: Device, image: ServedImage): CurrentScreen {
  return {
    kind: 'mirror',
    proxied: isProxied(device),
    mirrorMac: device.mirrorMac ?? '',
    imagePath: toImagePath(image.path, image.at),
    fetchedAt: toIsoString(image.at),
  }
}

function toScreenOfRotation(device: Device, image: ServedImage, screen: NonNullable<DeviceSummaryFacts['servedScreen']>): CurrentScreen {
  return {
    kind: 'screen',
    screenId: screen.id,
    name: screen.filename ?? '',
    imagePath: toImagePath(image.path, screen.generatedAt),
    renderedAt: toIsoString(screen.generatedAt),
    servedAt: toIsoString(image.at),
    paused: device.lastServedReason === 'asleep',
    holding: false,
  }
}

function toFallbackScreen(image: ServedImage, fallback: FallbackKind, reason: FallbackReason, screenId: string | null): CurrentScreen {
  return { kind: 'fallback', fallback, reason, screenId, imagePath: toImagePath(image.path, image.at), servedAt: toIsoString(image.at) }
}

function toCurrentScreen(device: Device, servedScreen: DeviceSummaryFacts['servedScreen']): CurrentScreen {
  const image = servedImageOf(device)
  if (!image)
    return WAITING_FOR_FIRST_POLL
  if (device.lastServedKind === 'mirror')
    return toMirroredScreen(device, image)
  if (device.lastServedKind === 'fallback')
    return toFallbackScreen(image, device.lastServedFallback ?? 'error', device.lastServedReason ?? 'renderFailed', device.lastServedScreenId ?? null)
  // A Screen deleted since it was served leaves the Device without one to name until its next poll.
  return servedScreen
    ? toScreenOfRotation(device, image, servedScreen)
    : toFallbackScreen(image, 'noScreen', 'noScreens', null)
}

function toClockTime(secondsOfDay: number | null | undefined): string | null {
  if (secondsOfDay == null)
    return null
  const twoDigits = (value: number) => String(value).padStart(2, '0')
  return `${twoDigits(Math.floor(secondsOfDay / 3600))}:${twoDigits(Math.floor(secondsOfDay % 3600 / 60))}`
}

function toSleepState(device: Device, now: Date): SleepState {
  const inWindow = !device.mirrorEnabled && isDeviceAsleep(device, now)
  return {
    enabled: device.sleepModeEnabled,
    start: toClockTime(device.sleepStartTime),
    end: toClockTime(device.sleepEndTime),
    whileAsleep: device.sleepScreenEnabled ? 'fallback' : 'keep',
    inWindow,
    endsAt: inWindow ? toIsoString(nextSleepEnd(device.sleepEndTime!, now)) : null,
  }
}

function toFiniteNumberOrNull(value: string | null | undefined): number | null {
  if (!value?.trim())
    return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function toPendingSpecialFunction(stored: string | undefined): SpecialFunction | null {
  return SPECIAL_FUNCTIONS.find(specialFunction => specialFunction === stored) ?? null
}

export function toDeviceSummary(device: Device, facts: DeviceSummaryFacts): DeviceSummary {
  const { deviceModel } = device
  return {
    id: device.id,
    name: device.name,
    friendlyId: device.friendlyId,
    firmwareVersion: device.fwVersion ?? null,
    deviceModel: deviceModel
      ? { name: deviceModel.name, label: deviceModel.label, width: deviceModel.width, height: deviceModel.height, deprecated: deviceModel.deprecated }
      : null,
    lastSeenAt: toIsoStringOrNull(device.lastSeen),
    nextPollAt: toIsoStringOrNull(nextPollOf(device)),
    batteryPercent: batteryPercentFromVoltage(device.batteryVoltage) ?? null,
    rssi: toFiniteNumberOrNull(device.rssi),
    isMirrored: !!device.mirrorEnabled,
    isProxied: isProxied(device),
    sleep: toSleepState(device, facts.now),
    currentScreen: toCurrentScreen(device, facts.servedScreen),
  }
}

export function toDeviceDetail(device: Device, facts: DeviceDetailFacts): DeviceDetail {
  const { palette, targetFirmware } = device
  return {
    ...toDeviceSummary(device, facts),
    mac: device.mac,
    apikey: device.apikey,
    refreshRate: device.refreshRate,
    reported: {
      batteryVoltage: device.batteryVoltage ?? null,
      rssi: device.rssi ?? null,
      firmwareVersion: device.fwVersion ?? null,
      model: device.reportedModel ?? null,
      width: device.width ?? null,
      height: device.height ?? null,
    },
    palette: palette ? { id: palette.id, name: palette.name, kind: palette.kind } : null,
    mirror: { enabled: !!device.mirrorEnabled, mac: device.mirrorMac ?? null, apikeySet: !!device.mirrorApikey },
    targetFirmware: targetFirmware
      ? { id: targetFirmware.id, version: targetFirmware.version, kind: targetFirmware.kind, label: targetFirmware.label ?? null, deprecated: targetFirmware.deprecated }
      : null,
    pending: {
      specialFunction: toPendingSpecialFunction(device.specialFunction),
      deviceReset: device.resetDevice,
      firmwarePush: device.updateFirmware,
    },
    sleepImagePath: null,
    sensors: facts.sensors.map(({ kind, value, unit }) => ({ kind, value, unit })),
    screenCount: facts.screenCount,
  }
}
