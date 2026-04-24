import type { MashupConfiguration } from '@/types/mashup'
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useMashupStore = defineStore('mashup', () => {
  const layouts = ref<any | null>(null)

  async function fetchLayouts() {
    const res = await fetch('/api/mashup/layouts')
    if (!res.ok)
      throw new Error('Failed to fetch layouts')
    layouts.value = await res.json()
  }

  async function create(deviceId: string, filename: string, layout: string, pluginIds: string[]) {
    const res = await fetch('/api/mashup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, filename, layout, pluginIds }),
    })
    if (!res.ok) {
      const error = await res.json()
      throw new Error(error.message || 'Failed to create mashup')
    }
    return await res.json()
  }

  async function update(screenId: string, filename: string, layout: string, pluginIds: string[]) {
    const res = await fetch(`/api/mashup/${screenId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename, layout, pluginIds }),
    })
    if (!res.ok) {
      const error = await res.json()
      throw new Error(error.message || 'Failed to update mashup')
    }
    return await res.json()
  }

  async function getConfiguration(screenId: string): Promise<MashupConfiguration> {
    const res = await fetch(`/api/mashup/${screenId}/configuration`)
    if (!res.ok)
      throw new Error('Failed to fetch mashup configuration')
    return await res.json()
  }

  return { layouts, fetchLayouts, create, update, getConfiguration }
})
