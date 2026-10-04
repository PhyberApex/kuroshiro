import type { InstanceFacts, InstanceSettingsResponse, UpdateInstanceSettingsInput } from 'kuroshiro-shared'
import { apiGet, apiSend } from './client'

export function getInstanceFacts() {
  return apiGet<InstanceFacts>('instance')
}

export function getInstanceSettings() {
  return apiGet<InstanceSettingsResponse>('settings')
}

/** Changes the Settings the input names and leaves the others: a value overrides, `null` clears the override. */
export function updateInstanceSettings(input: UpdateInstanceSettingsInput) {
  return apiSend<InstanceSettingsResponse>('PATCH', 'settings', input)
}
