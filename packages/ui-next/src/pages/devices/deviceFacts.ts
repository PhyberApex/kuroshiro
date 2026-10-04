import type { AlertKind, DeviceDetail, DeviceSensorKind, SleepState } from 'kuroshiro-shared'
import type { DeviceTold } from './currentScreenStory'
import type { Fact } from '@/components/fact'
import { FIRING_ALERT_LABELS } from '@/pages/alerts/alertLabels'
import { exactTime, relativeTime } from '@/patterns/time'
import { deviceSettingsPath } from './devicePaths'

export interface DeviceFact extends Fact {
  /** The instant the value words, for its exact time: the fact is shown as `lead` and that time. */
  at?: string
  lead?: string
}

const SENSOR_LABELS: Record<DeviceSensorKind, string> = {
  temperature: 'Temperature',
  humidity: 'Humidity',
  pressure: 'Pressure',
  carbon_dioxide: 'CO₂',
}

const MINUS = '−'

const signalOf = (rssi: number | null) => rssi === null ? null : `${rssi < 0 ? MINUS : ''}${Math.abs(rssi)} dBm`

function sleepModeOf({ enabled, start, end, inWindow }: SleepState, isMirrored: boolean) {
  if (isMirrored)
    return 'Off while Mirroring'
  if (!enabled || !start || !end)
    return 'Off'
  return inWindow ? `in its window until ${end}` : `${start}–${end}`
}

function lastSeenOf({ lastSeenAt }: DeviceDetail, offline: boolean, now: Date): DeviceFact {
  const lead = offline ? 'last seen ' : ''
  const seen = lastSeenAt ? new Date(lastSeenAt) : undefined
  return {
    label: 'Last seen',
    value: seen && `${lead}${relativeTime(seen, now) ?? exactTime(seen)}`,
    alert: offline ? FIRING_ALERT_LABELS['device-offline'] : undefined,
    at: lastSeenAt ?? undefined,
    lead,
  }
}

/** The Device reports a size, and it is not its Device Model's. */
export function reportsAnotherSize({ reported, deviceModel }: DeviceDetail) {
  return reported.width !== null && reported.height !== null && deviceModel !== null
    && (reported.width !== deviceModel.width || reported.height !== deviceModel.height)
}

function pendingFacts({ pending, targetFirmware }: DeviceDetail): DeviceFact[] {
  return [
    { label: 'Special Function', value: pending.specialFunction && `${pending.specialFunction} at the next poll`, pending: true },
    { label: 'Device Reset', value: pending.deviceReset ? 'at the next poll' : null, pending: true },
    { label: 'Firmware', value: pending.firmwarePush ? `${targetFirmware ? `${targetFirmware.version} ` : ''}at the next poll` : null, pending: true },
  ]
}

/** The fact rows of a Device, in the spec's order. A fact with nothing to say has no value and is left out by `FactRows`. */
export function deviceFacts({ device, alerts, now }: DeviceTold): DeviceFact[] {
  const firing = (kind: AlertKind) => alerts.some(alert => alert.kind === kind)
  return [
    lastSeenOf(device, firing('device-offline'), now),
    {
      label: 'Battery',
      value: device.batteryPercent === null ? null : `${device.batteryPercent} %`,
      alert: firing('device-low-battery') ? FIRING_ALERT_LABELS['device-low-battery'] : undefined,
    },
    { label: 'Signal', value: signalOf(device.rssi) },
    { label: 'Sleep Mode', value: sleepModeOf(device.sleep, device.isMirrored) },
    ...device.sensors.map(({ kind, value, unit }) => ({ label: SENSOR_LABELS[kind], value: `${value} ${unit}` })),
    {
      label: 'Device Model',
      value: reportsAnotherSize(device) ? 'reports another size' : null,
      to: deviceSettingsPath(device.id),
    },
    ...pendingFacts(device),
  ]
}
