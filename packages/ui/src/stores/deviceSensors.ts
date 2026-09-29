import type { SensorReading } from '../types'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { apiFetch } from '../utils/apiRequest'

function createDeviceSensorsStore(deviceId: string) {
  return () => {
    const error = ref('')
    const readings = ref<SensorReading[]>([])
    const loading = ref(true)

    apiFetch(`/api/devices/${deviceId}/sensors`).then(async (res) => {
      loading.value = false
      if (res.ok) {
        error.value = ''
        readings.value = await res.json()
      }
    }).catch(() => {
      loading.value = false
      error.value = 'Error fetching sensor readings.'
    })

    return { error, readings, loading }
  }
}

export function useDeviceSensorsStore(deviceId: string) {
  return defineStore(`device-sensors-${deviceId}`, createDeviceSensorsStore(deviceId))()
}
