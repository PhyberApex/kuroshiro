import type { ApplyRecipeUpdateInput, CreatePluginInput, ImportGithubPluginInput, ImportRecipeInput, PluginDetail, PluginImportResult, PluginSummary, PreviewData, PreviewDataInput, RecipeUpdatePreview, UpdatePluginInput } from 'kuroshiro-shared'
import { apiDownload, apiGet, apiSend } from './client'

/** Every Plugin as a row of the list, by name whatever its case. */
export function listPlugins() {
  return apiGet<PluginSummary[]>('plugins')
}

export function getPlugin(pluginId: string) {
  return apiGet<PluginDetail>(`plugins/${pluginId}`)
}

/**
 * Builds a Plugin from its name and Plugin Kind, with the starter template. With `deviceId` it is also assigned
 * to that Device, at the end of its Order; a Device that does not exist is refused with `device-not-found`.
 */
export function createPlugin(input: CreatePluginInput) {
  return apiSend<PluginDetail>('POST', 'plugins', input)
}

/**
 * Imports a Recipe from TRMNL as a Poll-kind Plugin tied to it. Refused with `recipe-id-invalid`, `recipe-not-found`,
 * `recipe-oauth`, `recipe-strategy-unsupported` or `recipe-static-transform`, and with `upstream-unreachable` when TRMNL does not answer.
 */
export function importRecipe(input: ImportRecipeInput) {
  return apiSend<PluginImportResult>('POST', 'plugins/import-recipe', input)
}

/** Imports the Plugin a `.zip` holds. Refused with `import-not-zip`, `import-no-plugin`, `import-legacy-format` or `upload-too-large`. */
export function importPluginFile(file: File, deviceId?: string) {
  const form = new FormData()
  form.append('file', file)
  if (deviceId)
    form.append('deviceId', deviceId)
  return apiSend<PluginImportResult>('POST', 'plugins/import', form)
}

/**
 * Imports the Plugin at the root of a public GitHub repository's branch `main`. Refused with `github-url-invalid`,
 * `github-repo-not-found` or `import-no-plugin`, and with `upstream-unreachable` when GitHub does not answer.
 */
export function importGithubPlugin(input: ImportGithubPluginInput) {
  return apiSend<PluginImportResult>('POST', 'plugins/import-github', input)
}

/**
 * Saves the keys it is given in one transaction and answers the Plugin as saved; the server then
 * renders it again in the background, so the answer's fetch and render facts can be a moment old.
 */
export function updatePlugin(pluginId: string, input: UpdatePluginInput) {
  return apiSend<PluginDetail>('PATCH', `plugins/${pluginId}`, input)
}

/**
 * The data a preview of the Plugin draws against, built from the form as it stands: it runs the Data Sources it is
 * sent, stores nothing and moves no Fetch Failure Streak. A Data Source that fails answers its error marker, and a
 * password Field Value reads as dots wherever it occurs. Refused with `device-not-found` for a Device that is gone.
 */
export function previewPluginData(pluginId: string, input: PreviewDataInput) {
  return apiSend<PreviewData>('POST', `plugins/${pluginId}/preview-data`, input)
}

/** Empties the Webhook Payload and renders the Plugin again without it. Refused with `plugin-not-webhook` for a Poll-kind Plugin. */
export function clearWebhookPayload(pluginId: string) {
  return apiSend<PluginDetail>('DELETE', `plugins/${pluginId}/webhook-payload`)
}

/** Issues a new Webhook Token: a POST to the old Webhook URL is refused from then on. Refused with `plugin-not-webhook` for a Poll-kind Plugin. */
export function regenerateWebhookToken(pluginId: string) {
  return apiSend<PluginDetail>('POST', `plugins/${pluginId}/webhook-token`)
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

/**
 * Downloads the Plugin's Recipe from TRMNL again and compares it. Refused with `plugin-not-from-recipe`, with
 * `recipe-not-found` when TRMNL no longer has it and `upstream-unreachable` when TRMNL does not answer.
 */
export function checkRecipeUpdate(pluginId: string) {
  return apiGet<RecipeUpdatePreview>(`plugins/${pluginId}/recipe-update`)
}

/**
 * Applies the chosen Update Items and takes the Recipe as it is now as the Recipe Snapshot; `apply: []` applies nothing.
 * Answers the Plugin, which the server then renders again in the background. Refused with `recipe-changed` when the
 * Recipe moved since the check.
 */
export function applyRecipeUpdate(pluginId: string, input: ApplyRecipeUpdateInput) {
  return apiSend<PluginDetail>('POST', `plugins/${pluginId}/recipe-update/apply`, input)
}
