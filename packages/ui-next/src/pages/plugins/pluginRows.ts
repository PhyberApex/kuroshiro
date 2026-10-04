import type { PluginSummary } from 'kuroshiro-shared'
import { listed } from './pluginWording'

/** What a row's state column says: an Alert (the only state in the seal colour), a problem, or a note that is nothing to fix. */
export interface PluginRowState {
  kind: 'alert' | 'problem' | 'note'
  text: string
}

const MOST_DEVICES_NAMED = 2

export function kindAndOrigin({ kind, sourceRecipeId }: PluginSummary) {
  return sourceRecipeId === null ? `${kind} Plugin` : `${kind} Plugin · from a Recipe`
}

/** Where a Plugin shows, from the names of the Devices it is assigned to and the Mashups it fills a slot in. */
export function whereItShows({ devices, mashups }: { devices: Array<{ name: string }>, mashups: PluginSummary['mashups'] }) {
  if (devices.length > MOST_DEVICES_NAMED)
    return `On ${devices.length} Devices`
  if (devices.length > 0)
    return `On ${listed(devices.map(device => device.name))}`
  return mashups.length > 0 ? `In a Mashup on ${mashups[0]!.deviceName}` : 'Not on a Device'
}

/** In the order of precedence: the first that applies is the row's state. */
const STATES: Array<(plugin: PluginSummary) => PluginRowState | false> = [
  plugin => plugin.fetchAlertFiring && { kind: 'alert', text: 'Alert: a Data Source keeps failing' },
  plugin => plugin.worstFetchFailureStreak === 1 && { kind: 'problem', text: 'The last fetch failed' },
  plugin => plugin.worstFetchFailureStreak > 1 && { kind: 'problem', text: `${plugin.worstFetchFailureStreak} fetches failed in a row` },
  plugin => plugin.needsValues && { kind: 'problem', text: 'A required Plugin Field is empty' },
  plugin => plugin.webhookPayloadStored === false && { kind: 'note', text: 'Nothing received yet' },
]

export function pluginRowState(plugin: PluginSummary): PluginRowState | undefined {
  return STATES.map(state => state(plugin)).find(state => state !== false) || undefined
}

export function hasProblem(plugin: PluginSummary) {
  const state = pluginRowState(plugin)
  return state !== undefined && state.kind !== 'note'
}

export interface PluginsFilter {
  /** What the name has to hold, whatever its case. */
  query: string
  problemsOnly: boolean
}

export function matchingPlugins(plugins: PluginSummary[], { query, problemsOnly }: PluginsFilter) {
  const sought = query.trim().toLowerCase()
  return plugins.filter(plugin => plugin.name.toLowerCase().includes(sought) && (!problemsOnly || hasProblem(plugin)))
}

interface Counts extends PluginsFilter {
  total: number
  shown: number
  withProblem: number
}

export function countLine({ total, shown, withProblem, query, problemsOnly }: Counts) {
  const plugins = total === 1 ? 'Plugin' : 'Plugins'
  const counted = query.trim() || problemsOnly ? `${shown} of ${total} ${plugins}` : `${total} ${plugins}, by name`
  return withProblem > 0 && !problemsOnly ? `${counted} · ${withProblem} with a problem` : counted
}

export function noMatchSentence({ query, problemsOnly }: PluginsFilter) {
  if (!query.trim())
    return 'No Plugin has a problem.'
  return `No Plugin is called “${query.trim()}”${problemsOnly ? ' among those with a problem' : ''}.`
}
