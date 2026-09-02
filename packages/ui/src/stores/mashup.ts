import { defineStore } from 'pinia'
import { apiFetch } from '../utils/apiRequest'

export const useMashupStore = defineStore('mashup', () => {
  async function create(deviceId: string, filename: string, layout: string, pluginIds: string[]) {
    const res = await apiFetch('/api/mashup', {
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

  return { create }
})
