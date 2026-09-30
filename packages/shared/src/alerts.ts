export type AlertKind = 'device-low-battery' | 'device-offline'

export const ALERT_KIND_LABELS: Record<AlertKind, string> = {
  'device-low-battery': 'Low battery',
  'device-offline': 'Offline',
}

export interface AlertSummary {
  id: string
  kind: AlertKind
  deviceId: string
  deviceName: string
  openedAt: string
  resolvedAt: string | null
  details: Record<string, unknown> | null
}

export interface AlertsList {
  active: AlertSummary[]
  resolved: AlertSummary[]
}
