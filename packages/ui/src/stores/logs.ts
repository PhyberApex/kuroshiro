import type { LogEntry } from '../types'
import { defineStore } from 'pinia'
import { ref } from 'vue'

function createLogStore(deviceId: string) {
  return () => {
    const error = ref('')
    const logEntries = ref([] as LogEntry[])
    const loading = ref(true)

    const clearLogs = async () => {
      loading.value = true
      const res = await fetch(`/api/log/device/${deviceId}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        error.value = ''
      }
      loading.value = false
    }

    fetch(`/api/log/device/${deviceId}`).then(async (res) => {
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
