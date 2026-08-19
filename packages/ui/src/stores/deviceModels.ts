import type { DeviceModel, DeviceModelSyncResult, Palette } from '../types'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export const useDeviceModelsStore = defineStore('deviceModels', () => {
  const models = ref<DeviceModel[]>([])
  const palettes = ref<Palette[]>([])
  const loaded = ref(false)
  const syncing = ref(false)
  const error = ref<string | null>(null)

  const activeModels = computed(() => models.value.filter(model => !model.deprecated))

  let inFlight: Promise<void> | null = null

  async function fetchAll() {
    try {
      const [modelsRes, palettesRes] = await Promise.all([fetch('/api/device-models'), fetch('/api/device-models/palettes')])
      if (!modelsRes.ok)
        throw new Error(`${modelsRes.status} ${modelsRes.statusText}`)
      if (!palettesRes.ok)
        throw new Error(`${palettesRes.status} ${palettesRes.statusText}`)
      models.value = await modelsRes.json()
      palettes.value = await palettesRes.json()
      loaded.value = true
      error.value = null
    }
    catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load device models'
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

  function getByName(name: string | null | undefined) {
    return models.value.find(model => model.name === name)
  }

  function palettesFor(model: DeviceModel | null | undefined) {
    if (!model)
      return []
    return model.paletteIds
      .map(id => palettes.value.find(palette => palette.id === id))
      .filter((palette): palette is Palette => !!palette)
  }

  async function sync(): Promise<DeviceModelSyncResult | null> {
    syncing.value = true
    error.value = null
    try {
      const res = await fetch('/api/device-models/sync', { method: 'POST' })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.message ?? `Sync failed: ${res.statusText}`)
      }
      const result: DeviceModelSyncResult = await res.json()
      await fetchAll()
      return result
    }
    catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to sync device models'
      return null
    }
    finally {
      syncing.value = false
    }
  }

  return { models, palettes, activeModels, loaded, syncing, error, fetchAll, ensureLoaded, getByName, palettesFor, sync }
})
