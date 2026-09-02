import type { LogEntry } from '../types'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { apiFetch } from '../utils/apiRequest'

function createLogStore(deviceId: string) {
  return () => {
    const error = ref('')
    const logEntries = ref<LogEntry[]>([])
    const loading = ref(true)

    const clearLogs = async () => {
      loading.value = true
      const res = await apiFetch(`/api/log/device/${deviceId}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        error.value = ''
      }
      loading.value = false
    }

    apiFetch(`/api/log/device/${deviceId}`).then(async (res) => {
      loading.value = false
      if (res.ok) {
        error.value = ''
        logEntries.value = await res.json()
      }
    }).catch(() => {
      loading.value = false
      error.value = 'Error fetching logs.'
    })

    return { error, logEntries, loading, clearLogs }
  }
}

export function useLogStore(deviceId: string) {
  return defineStore(`log-${deviceId}`, createLogStore(deviceId))()
}
