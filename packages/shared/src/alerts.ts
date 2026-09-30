export type AlertKind = 'device-low-battery' | 'device-offline' | 'data-source-fetch-failing'

export const ALERT_KIND_LABELS: Record<AlertKind, string> = {
  'device-low-battery': 'Low battery',
  'device-offline': 'Offline',
  'data-source-fetch-failing': 'Fetch failing',
}

// A Device-subject Alert carries deviceId/deviceName; a Data-Source-subject
// Alert (data-source-fetch-failing) carries dataSourceId/dataSourceName/
// pluginName instead — never both (ADR-0025).
export interface AlertSummary {
  id: string
  kind: AlertKind
  deviceId?: string
  deviceName?: string
  dataSourceId?: string
  dataSourceName?: string
  pluginName?: string
  openedAt: string
  resolvedAt: string | null
  details: Record<string, unknown> | null
}

export interface AlertsList {
  active: AlertSummary[]
  resolved: AlertSummary[]
}
