import type { CurrentScreen, Screen } from '@/types'
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useScreensStore = defineStore('screens', () => {
  const screens = ref<Screen[]>([])
  const currentScreen = ref<CurrentScreen | null>(null)

  async function fetchScreensForDevice(deviceId: string) {
    const res = await fetch(`/api/screens/device/${deviceId}`)
    screens.value = await res.json()
  }

  async function fetchCurrentScreenForDevice(mac: string, apikey: string) {
    const res = await fetch(`/api/current_screen`, {
      headers: {
        'id': mac,
        'access-token': apikey,
      },
    })
    currentScreen.value = await res.json()
  }

  async function addScreen(deviceId: string, externalLink: string, fetchManual: boolean, filename: string) {
    const res = await fetch('/api/screens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, filename, externalLink, fetchManual }),
    })
    if (res.ok) {
      await fetchScreensForDevice(deviceId)
    }
  }

  async function addScreenFile(deviceId: string, file: File, filename: string) {
    const formData = new FormData()
    formData.append('deviceId', deviceId)
    formData.append('filename', filename)
    formData.append('file', file)
    const res = await fetch('/api/screens', {
      method: 'POST',
      body: formData,
    })
    if (res.ok) {
      await fetchScreensForDevice(deviceId)
    }
  }

  async function addScreenHtml(deviceId: string, html: string, filename: string) {
    const res = await fetch('/api/screens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, filename, html }),
    })
    if (res.ok) {
      await fetchScreensForDevice(deviceId)
    }
  }

  async function deleteScreen(deviceId: string, screenId: string) {
    const res = await fetch(`/api/screens/${screenId}`, {
      method: 'DELETE',
    })
    if (res.ok) {
      await fetchScreensForDevice(deviceId)
    }
  }

  async function updateExternalScreen(deviceId: string, screenId: string) {
    const res = await fetch(`/api/screens/${screenId}`, {
      method: 'POST',
    })
    if (res.ok) {
      await fetchScreensForDevice(deviceId)
    }
  }

  return { screens, currentScreen, fetchScreensForDevice, addScreen, addScreenFile, addScreenHtml, deleteScreen, updateExternalScreen, fetchCurrentScreenForDevice }
})
