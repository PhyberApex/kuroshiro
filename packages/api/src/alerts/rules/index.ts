import type { AlertRule } from './alert-rule.js'
import { dataSourceFetchFailingRule } from './data-source-fetch-failing.rule.js'
import { lowBatteryRule } from './low-battery.rule.js'
import { offlineRule } from './offline.rule.js'

export const ALERT_RULES: AlertRule[] = [lowBatteryRule, offlineRule, dataSourceFetchFailingRule]

export * from './alert-rule.js'
export * from './data-source-fetch-failing.rule.js'
export * from './low-battery.rule.js'
export * from './offline.rule.js'
