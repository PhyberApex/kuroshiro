import type { AlertsList, ListAlertsQuery } from 'kuroshiro-shared'
import { apiGet } from './client'

/** The firing Alerts and the recently resolved ones, of one Device or Plugin when the query names it. */
export function listAlerts(query: ListAlertsQuery = {}) {
  return apiGet<AlertsList>('alerts', { ...query })
}
