import type { AlertRule } from './alert-rule.js'
import { batteryPercentFromVoltage } from 'kuroshiro-shared'

const RESOLVE_HYSTERESIS_PERCENT = 5

export const lowBatteryRule: AlertRule = {
  kind: 'device-low-battery',

  evaluate(device, context, hasActiveAlert) {
    const percent = batteryPercentFromVoltage(device.batteryVoltage)
    // A Device with no reported voltage is skipped entirely (never opens, never resolves).
    if (percent === undefined)
      return { skip: true, active: hasActiveAlert }

    const threshold = hasActiveAlert ? context.lowBatteryPercent + RESOLVE_HYSTERESIS_PERCENT : context.lowBatteryPercent
    return { active: percent < threshold, details: { percent } }
  },

  openedNotification(device, details) {
    return {
      title: `Kuroshiro: ${device.name} battery low`,
      body: `${device.name} (${device.mac}) is at ${details.percent}%.`,
      type: 'warning',
    }
  },

  resolvedNotification(device, details) {
    return {
      title: `Kuroshiro: ${device.name} battery recovered`,
      body: `${device.name} (${device.mac}) is at ${details.percent}%.`,
      type: 'success',
    }
  },
}
