import type { PluginDetail, PluginSummary } from 'kuroshiro-shared'
import { apiDownload, apiGet, apiSend } from './client'

/** Every Plugin as a row of the list, by name whatever its case. */
export function listPlugins() {
  return apiGet<PluginSummary[]>('plugins')
}

export function getPlugin(pluginId: string) {
  return apiGet<PluginDetail>(`plugins/${pluginId}`)
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
