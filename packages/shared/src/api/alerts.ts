export type AlertKind = 'device-low-battery' | 'device-offline' | 'data-source-fetch-failing'

export const ALERT_KIND_LABELS: Record<AlertKind, string> = {
  'device-low-battery': 'Low battery',
  'device-offline': 'Offline',
  'data-source-fetch-failing': 'Fetch failing',
}

/** What a low-battery Alert fired at: the battery's percent. */
export interface LowBatteryDetails {
  percent: number
}

/** What an offline Alert fired for: the ISO instant the Device was last seen. */
export interface OfflineDetails {
  lastSeen: string
}

/** What a fetch Alert fired for: the Fetch Failure Streak and the last error the Data Source answered. */
export interface FetchFailingDetails {
  streak: number
  lastError: string | null
}

/** The cause an Alert fired with, as of the last Alert Sweep while it fired. Which shape it is follows the Alert's kind. */
export type AlertDetails = LowBatteryDetails | OfflineDetails | FetchFailingDetails

// A Device-subject Alert carries deviceId/deviceName; a Data-Source-subject
// Alert (data-source-fetch-failing) carries pluginId/pluginName/dataSourceId/
// dataSourceName instead — never both (ADR-0025). The subject keys stay
// optional rather than null because the old UI reads this type as it is.
export interface AlertSummary {
  id: string
  kind: AlertKind
  deviceId?: string
  deviceName?: string
  dataSourceId?: string
  dataSourceName?: string
  pluginId?: string
  pluginName?: string
  openedAt: string
  resolvedAt: string | null
  details: AlertDetails | null
}

export interface AlertsList {
  active: AlertSummary[]
  resolved: AlertSummary[]
}

export interface ListAlertsQuery {
  deviceId?: string
  pluginId?: string
  resolvedSince?: string
}
