import type { AlertRule } from './alert-rule.js'
import { lowBatteryRule } from './low-battery.rule.js'
import { offlineRule } from './offline.rule.js'

export const ALERT_RULES: AlertRule[] = [lowBatteryRule, offlineRule]

export * from './alert-rule.js'
export * from './low-battery.rule.js'
export * from './offline.rule.js'
