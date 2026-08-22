import type { Firmware, FirmwareSyncResult } from '../types'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export const useFirmwareStore = defineStore('firmware', () => {
  const firmware = ref<Firmware[]>([])
  const loaded = ref(false)
  const syncing = ref(false)
  const uploading = ref(false)
  const error = ref<string | null>(null)

  const activeFirmware = computed(() => firmware.value.filter(fw => !fw.deprecated))

  let inFlight: Promise<void> | null = null

  async function fetchAll() {
    try {
      const res = await fetch('/api/firmware')
      if (!res.ok)
        throw new Error(`${res.status} ${res.statusText}`)
      firmware.value = await res.json()
      loaded.value = true
      error.value = null
    }
    catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load firmware'
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

  function getById(id: string | null | undefined) {
    return firmware.value.find(fw => fw.id === id)
  }

  function compatibleWith(modelName: string | null | undefined) {
    return activeFirmware.value.filter(fw => fw.compatibleModels.length === 0 || (modelName && fw.compatibleModels.includes(modelName)))
  }

  async function sync(): Promise<FirmwareSyncResult | null> {
    syncing.value = true
    error.value = null
    try {
      const res = await fetch('/api/firmware/sync', { method: 'POST' })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.message ?? `Sync failed: ${res.statusText}`)
      }
      const result: FirmwareSyncResult = await res.json()
      await fetchAll()
      return result
    }
    catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to sync firmware'
      return null
    }
    finally {
      syncing.value = false
    }
  }

  async function upload(file: File, version: string, label?: string, compatibleModels?: string[]): Promise<boolean> {
    uploading.value = true
    error.value = null
    try {
      const body = new FormData()
      body.append('file', file)
      body.append('version', version)
      if (label)
        body.append('label', label)
      if (compatibleModels)
        body.append('compatibleModels', JSON.stringify(compatibleModels))
      const res = await fetch('/api/firmware/upload', { method: 'POST', body })
      if (!res.ok) {
        const errBody = await res.json().catch(() => null)
        throw new Error(errBody?.message ?? `Upload failed: ${res.statusText}`)
      }
      await fetchAll()
      return true
    }
    catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to upload firmware'
      return false
    }
    finally {
      uploading.value = false
    }
  }

  async function remove(id: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/firmware/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.message ?? `Delete failed: ${res.statusText}`)
      }
      await fetchAll()
      return true
    }
    catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to delete firmware'
      return false
    }
  }

  return { firmware, activeFirmware, loaded, syncing, uploading, error, fetchAll, ensureLoaded, getById, compatibleWith, sync, upload, remove }
})
