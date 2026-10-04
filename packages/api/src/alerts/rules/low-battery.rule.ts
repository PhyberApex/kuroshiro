import type { Device } from '../../devices/devices.entity.js'
import type { AlertRule } from './alert-rule.js'
import { batteryPercentFromVoltage } from 'kuroshiro-shared'
import { deviceSubjectFields } from './alert-rule.js'

const RESOLVE_HYSTERESIS_PERCENT = 5

export const lowBatteryRule: AlertRule = {
  kind: 'device-low-battery',
  ...deviceSubjectFields(),

  evaluate(subject, context, hasActiveAlert) {
    const device = subject as Device
    const percent = batteryPercentFromVoltage(device.batteryVoltage)
    // A Device with no reported voltage is skipped entirely (never opens, never resolves).
    if (percent === undefined)
      return { skip: true, active: hasActiveAlert }

    const threshold = hasActiveAlert ? context.lowBatteryPercent + RESOLVE_HYSTERESIS_PERCENT : context.lowBatteryPercent
    const active = percent < threshold
    return active ? { active, details: { percent } } : { active }
  },

  openedNotification(subject) {
    const device = subject as Device
    return {
      title: `Kuroshiro: ${device.name} battery low`,
      body: `${device.name} (${device.mac}) is at ${batteryPercentFromVoltage(device.batteryVoltage)}%.`,
      type: 'warning',
    }
  },

  resolvedNotification(subject) {
    const device = subject as Device
    const percent = batteryPercentFromVoltage(device.batteryVoltage)
    return {
      title: `Kuroshiro: ${device.name} battery recovered`,
      body: percent === undefined ? `${device.name} (${device.mac}) is no longer low on battery.` : `${device.name} (${device.mac}) is at ${percent}%.`,
      type: 'success',
    }
  },
}
