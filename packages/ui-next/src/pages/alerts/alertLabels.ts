import type { AlertKind } from 'kuroshiro-shared'

/** What a firing Alert is called wherever it shows: on the Alerts page, on its Device and on its Plugin. */
export const FIRING_ALERT_LABELS: Record<AlertKind, string> = {
  'device-low-battery': 'Alert: battery low',
  'device-offline': 'Alert: offline',
  'data-source-fetch-failing': 'Alert: a Data Source keeps failing',
}

/** What an Alert that resolved is called: its kind in the past, which is never shown in the seal colour. */
export const RESOLVED_ALERT_LABELS: Record<AlertKind, string> = {
  'device-low-battery': 'Battery low',
  'device-offline': 'Offline',
  'data-source-fetch-failing': 'A Data Source kept failing',
}
