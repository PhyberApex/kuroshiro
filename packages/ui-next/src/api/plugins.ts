import type { PluginDetail, PluginSummary, UpdatePluginInput } from 'kuroshiro-shared'
import { apiDownload, apiGet, apiSend } from './client'

/** Every Plugin as a row of the list, by name whatever its case. */
export function listPlugins() {
  return apiGet<PluginSummary[]>('plugins')
}

export function getPlugin(pluginId: string) {
  return apiGet<PluginDetail>(`plugins/${pluginId}`)
}

/**
 * Saves the keys it is given in one transaction and answers the Plugin as saved; the server then
 * renders it again in the background, so the answer's fetch and render facts can be a moment old.
 */
export function updatePlugin(pluginId: string, input: UpdatePluginInput) {
  return apiSend<PluginDetail>('PATCH', `plugins/${pluginId}`, input)
}

/** Answers the copy, "{Plugin} (copy)", which is on no Device. */
export function duplicatePlugin(pluginId: string) {
  return apiSend<PluginDetail>('POST', `plugins/${pluginId}/duplicate`)
}

/** Refused with `plugin-in-mashup` while a Mashup holds the Plugin in a slot; `details.mashups` names them. */
export function deletePlugin(pluginId: string) {
  return apiSend('DELETE', `plugins/${pluginId}`)
}

/** Downloads the Plugin as `{Plugin}.trmnlp.zip`. */
export function exportPlugin(pluginId: string) {
  apiDownload(`plugins/${pluginId}/export`)
}
