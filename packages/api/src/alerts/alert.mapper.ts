import type { AlertSummary } from 'kuroshiro-shared'
import type { Alert } from './entities/alert.entity.js'
import { toIsoStringOrNull } from '../utils/readModel.js'

/** `undefined` for an Alert whose subject relation (Device or Data Source) is missing — cascade-deleted, or deleted between the query and the join. */
export function toAlertSummary(alert: Alert): AlertSummary | undefined {
  const device = alert.device ? { id: alert.device.id, name: alert.device.name } : null
  const dataSource = alert.dataSource ? { id: alert.dataSource.id, name: alert.dataSource.name } : null
  const plugin = alert.dataSource ? { id: alert.dataSource.plugin.id, name: alert.dataSource.plugin.name } : null
  if (!device && !dataSource)
    return undefined
  return {
    id: alert.id,
    kind: alert.kind,
    device,
    plugin,
    dataSource,
    openedAt: alert.openedAt.toISOString(),
    resolvedAt: toIsoStringOrNull(alert.resolvedAt),
    details: alert.details ?? null,
  }
}

export function toAlertSummaries(alerts: Alert[]): AlertSummary[] {
  return alerts.map(toAlertSummary).filter((summary): summary is AlertSummary => summary !== undefined)
}
