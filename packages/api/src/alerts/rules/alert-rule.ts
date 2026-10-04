import type { AlertDetails, AlertKind } from 'kuroshiro-shared'
import type { FindOptionsRelations } from 'typeorm'
import type { Device } from '../../devices/devices.entity.js'
import type { PluginDataSource } from '../../plugins/entities/plugin-data-source.entity.js'
import type { Alert } from '../entities/alert.entity.js'

export interface AlertRuleContext {
  now: Date
  lowBatteryPercent: number
  offlineMultiplier: number
  fetchFailureThreshold: number
}

export interface AlertEvaluation {
  /** True when the Rule has nothing to say this Sweep — an existing Alert (if any) is left untouched. */
  skip?: boolean
  active: boolean
  /** The cause, when `active`: what the Alert keeps as its `details`. */
  details?: AlertDetails
}

export interface NotificationContent {
  title: string
  body: string
  type: 'warning' | 'failure' | 'success'
}

/** Every subject an Alert Rule can watch this Sweep, loaded once and shared across Rules. */
export interface SweepSubjects {
  devices: Device[]
  dataSources: PluginDataSource[]
}

/**
 * A named condition the Sweep watches for on some subject (ADR-0025 lifted
 * this off being Device-only). A Rule declares which of `SweepSubjects` it
 * watches, how to read a subject's id, how to read a subject back off a
 * persisted `Alert`'s relations, and how to attach a subject to a new one —
 * the Sweep stays subject-agnostic and never touches `device`/`dataSource`
 * directly. Subjects are typed `unknown` here so one array can hold every
 * Rule regardless of subject type; each Rule module narrows internally.
 */
export interface AlertRule {
  kind: AlertKind
  /** The `Alert` relations the Sweep must load so `subjectFromAlert` can read a persisted Alert's subject back. */
  alertRelations: FindOptionsRelations<Alert>
  subjects: (all: SweepSubjects) => unknown[]
  subjectId: (subject: unknown) => string
  /** `undefined` when the Alert's subject relation is missing — cascade-deleted, or deleted between the query and the join. */
  subjectFromAlert: (alert: Alert) => unknown
  toAlertSubject: (subject: unknown) => Partial<Alert>
  /** `hasActiveAlert` lets a Rule apply hysteresis around its own open/resolve boundary. */
  evaluate: (subject: unknown, context: AlertRuleContext, hasActiveAlert: boolean) => AlertEvaluation
  /** Both Notifications are worded from the subject as it is when they are sent; an Alert's `details` are the cause it fired with, not the recovery. */
  openedNotification: (subject: unknown) => NotificationContent
  resolvedNotification: (subject: unknown) => NotificationContent
}

/** The subject-plumbing fields shared by every Device-scoped Rule (low battery, offline) — only `evaluate`/the two Notification builders differ between them. */
export function deviceSubjectFields(): Pick<AlertRule, 'alertRelations' | 'subjects' | 'subjectId' | 'subjectFromAlert' | 'toAlertSubject'> {
  return {
    alertRelations: { device: true },
    subjects: all => all.devices,
    subjectId: subject => (subject as Device).id,
    subjectFromAlert: alert => alert.device ?? undefined,
    toAlertSubject: subject => ({ device: subject as Device }),
  }
}
