import type { DataSourceRead } from 'kuroshiro-shared'
import type { DataSourceDraft } from './pluginDataSources'
import type { PluginRowState } from './pluginRows'
import { failedFetches } from './pluginRows'

/** A Data Source whose name field is empty still needs a name for its row's button. */
export const dataSourceName = (row: DataSourceDraft) => row.name.trim() || 'Unnamed Data Source'

/** A row's line under the name: the request without its scheme, or that the value is fixed. */
export function whatItIs(row: DataSourceDraft) {
  return row.mode === 'literal' ? 'literal · a fixed value' : `${row.method} ${row.url.trim().replace(/^https?:\/\//i, '')}`
}

/** How a Data Source's fetches stand. A literal one is never fetched, and one that was added has no fetch behind it. */
export type FetchStanding = 'literal' | 'failing' | 'fetched' | 'never'

export function fetchStanding(row: DataSourceDraft, facts: DataSourceRead | undefined): FetchStanding {
  if (row.mode === 'literal')
    return 'literal'
  if (facts && facts.fetchFailureStreak > 0)
    return 'failing'
  return facts?.lastFetchSucceededAt ? 'fetched' : 'never'
}

/** What a row's health says of a Data Source whose fetches fail: the Alert, the only state in the seal colour, or the streak. */
export function fetchTrouble(facts: DataSourceRead): PluginRowState {
  return facts.alertFiring
    ? { kind: 'alert', text: 'Alert: keeps failing' }
    : { kind: 'problem', text: failedFetches(facts.fetchFailureStreak) }
}

export const FIRING_ALERT_STORY: PluginRowState = { kind: 'alert', text: 'Alert: this Data Source keeps failing' }

/** "the last 3 scheduled fetches failed", which follows "Its Fetch Failure Streak is 3: ". */
export const failedScheduledFetches = (streak: number) => streak === 1 ? 'the last scheduled fetch failed' : `the last ${streak} scheduled fetches failed`

export function transformTitle(code: string) {
  const lines = code.trim() === '' ? 0 : code.replace(/\n$/, '').split('\n').length
  if (lines === 0)
    return 'Transform · none'
  return `Transform · JavaScript, ${lines === 1 ? '1 line' : `${lines} lines`}`
}
