import type { InstanceSettingsResponse, UpdateInstanceSettingsInput } from 'kuroshiro-shared'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { apiFetch, failureMessage } from '../utils/apiRequest'

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<InstanceSettingsResponse | null>(null)
  const loaded = ref(false)
  const error = ref<string | null>(null)
  const saving = ref(false)

  let inFlight: Promise<void> | null = null

  async function fetchAll() {
    try {
      const res = await apiFetch('/api/settings')
      if (!res.ok)
        throw new Error(await failureMessage(res, `Failed to load Settings: ${res.statusText}`))
      settings.value = await res.json()
      loaded.value = true
      error.value = null
    }
    catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load Settings'
      loaded.value = false
    }
  }

  function ensureLoaded() {
    if (loaded.value)
      return Promise.resolve()
    inFlight ??= fetchAll().finally(() => {
      inFlight = null
    })
    return inFlight
  }

  /** Sets `error` on failure (surfaced by the Settings card) and clears it on a subsequent success, the same as `fetchAll`. */
  async function update(input: UpdateInstanceSettingsInput): Promise<{ ok: boolean, message?: string }> {
    saving.value = true
    try {
      const res = await apiFetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      if (!res.ok)
        throw new Error(await failureMessage(res, `Failed to save Settings: ${res.statusText}`))
      settings.value = await res.json()
      error.value = null
      return { ok: true }
    }
    catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save Settings'
      error.value = message
      return { ok: false, message }
    }
    finally {
      saving.value = false
    }
  }

  return { settings, loaded, error, saving, fetchAll, ensureLoaded, update }
})
