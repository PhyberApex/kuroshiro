import type { DeviceModel } from '../device-models/entities/device-model.entity.js'
import type { Device } from '../devices/devices.entity.js'
import type { PluginRenderContext } from './services/plugin-template-context.service.js'
import { batteryPercentFromVoltage } from 'kuroshiro-shared'

/**
 * `trmnl.device` as trmnlp's `device_namespace` spells it, for the Device a
 * render is for (ADR-0066). The size is the Device Model's, which is the page
 * the template is laid out on. A key the Device has not reported or set is
 * left out, as is `wifi_strength`: Kuroshiro keeps the raw RSSI and has no
 * TRMNL-equal way to read it as a percentage.
 */
export interface TrmnlDevice {
  friendly_id: string
  percent_charged?: number
  width: number
  height: number
  model: string
  bit_depth: number
  orientation: 'landscape' | 'portrait'
  firmware_version?: string
  refresh_interval_seconds: number
  sleep_mode_enabled: boolean
  /** Minutes after midnight, as TRMNL counts them; the Device stores seconds. */
  sleep_start_time?: number
  sleep_end_time?: number
}

const minutesOf = (seconds: number | null | undefined): number | undefined => seconds == null ? undefined : Math.floor(seconds / 60)

export function trmnlDeviceOf(device: Device, model: DeviceModel): TrmnlDevice {
  const told: TrmnlDevice = {
    friendly_id: device.friendlyId,
    percent_charged: batteryPercentFromVoltage(device.batteryVoltage),
    width: model.width,
    height: model.height,
    model: model.name,
    bit_depth: model.bitDepth,
    orientation: model.height > model.width ? 'portrait' : 'landscape',
    firmware_version: device.fwVersion || undefined,
    refresh_interval_seconds: device.refreshRate,
    sleep_mode_enabled: device.sleepModeEnabled,
    sleep_start_time: minutesOf(device.sleepStartTime),
    sleep_end_time: minutesOf(device.sleepEndTime),
  }
  return Object.fromEntries(Object.entries(told).filter(([, value]) => value !== undefined)) as TrmnlDevice
}

/**
 * A render's context with `trmnl.device` told for the Device it is rendered
 * for. The data was fetched without it, so a Data Source never reads it. A
 * Webhook Payload that is an array is the whole context and has no `trmnl` to
 * hold it.
 */
export function withTrmnlDevice(context: PluginRenderContext['context'], device: Device, model: DeviceModel): PluginRenderContext['context'] {
  if (Array.isArray(context))
    return context
  const trmnl = typeof context.trmnl === 'object' && context.trmnl !== null ? context.trmnl : {}
  return { ...context, trmnl: { ...trmnl, device: trmnlDeviceOf(device, model) } }
}
