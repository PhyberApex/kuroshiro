import { defineStore } from 'pinia'

export const useMashupStore = defineStore('mashup', () => {
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

  return { create }
})
