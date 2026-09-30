import type { AlertsList, AlertSummary } from 'kuroshiro-shared'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { apiRequest } from '../utils/apiRequest'

export const useAlertsStore = defineStore('alerts', () => {
  const active = ref<AlertSummary[]>([])
  const resolved = ref<AlertSummary[]>([])
  const loaded = ref(false)
  const error = ref<string | null>(null)
  const sendingTestNotification = ref(false)

  let inFlight: Promise<void> | null = null

  async function fetchAll() {
    try {
      const list = await apiRequest<AlertsList>('/api/alerts', undefined, res => `Failed to load Alerts: ${res.statusText}`)
      active.value = list.active
      resolved.value = list.resolved
      loaded.value = true
      error.value = null
    }
    catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load Alerts'
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

  function activeForDevice(deviceId: string): AlertSummary[] {
    return active.value.filter(alert => alert.deviceId === deviceId)
  }

  async function sendTestNotification(): Promise<{ ok: boolean, message: string }> {
    sendingTestNotification.value = true
    try {
      const result = await apiRequest<{ message: string }>('/api/alerts/test-notification', { method: 'POST' }, res => `Test notification failed: ${res.statusText}`)
      return { ok: true, message: result.message }
    }
    catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : 'Failed to send test notification' }
    }
    finally {
      sendingTestNotification.value = false
    }
  }

  return { active, resolved, loaded, error, sendingTestNotification, fetchAll, ensureLoaded, activeForDevice, sendTestNotification }
})
