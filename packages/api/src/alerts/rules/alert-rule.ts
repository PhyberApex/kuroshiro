import type { Device } from '../../devices/devices.entity.js'
import type { AlertKind } from '../entities/alert.entity.js'

export interface AlertRuleContext {
  now: Date
  lowBatteryPercent: number
  offlineMultiplier: number
}

export interface AlertEvaluation {
  /** True when the Rule has nothing to say this Sweep — an existing Alert (if any) is left untouched. */
  skip?: boolean
  active: boolean
  details?: Record<string, unknown>
}

export interface NotificationContent {
  title: string
  body: string
  type: 'warning' | 'failure' | 'success'
}

export interface AlertRule {
  kind: AlertKind
  /** `hasActiveAlert` lets a Rule apply hysteresis around its own open/resolve boundary. */
  evaluate: (device: Device, context: AlertRuleContext, hasActiveAlert: boolean) => AlertEvaluation
  openedNotification: (device: Device, details: Record<string, unknown>) => NotificationContent
  resolvedNotification: (device: Device, details: Record<string, unknown>) => NotificationContent
}
