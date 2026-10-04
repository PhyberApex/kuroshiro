import type { AlertsList, ListAlertsQuery } from 'kuroshiro-shared'
import { apiGet, apiSend } from './client'

/** The firing Alerts and the recently resolved ones, of one Device or Plugin when the query names it. */
export function listAlerts(query: ListAlertsQuery = {}) {
  return apiGet<AlertsList>('alerts', { ...query })
}

/** Sends a Test Notification through Apprise. Refused with `notifications-off` or `notification-failed`. */
export function sendTestNotification() {
  return apiSend<{ message: string }>('POST', 'alerts/test-notification')
}
