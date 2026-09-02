import type { Device } from '../types'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { apiFetch } from '../utils/apiRequest'

export type CreateDevice = Pick<Device, 'mac' | 'name'>
type UpdateDevice = Partial<Omit<Device, 'id' | 'mac' | 'friendlyId' | 'deviceModel' | 'palette' | 'targetFirmware'>> & { deviceModelName?: string, paletteId?: string, targetFirmwareId?: string }

export const useDeviceStore = defineStore('device', () => {
  const devices = ref<Device[]>([])

  async function fetchDevices() {
    const res = await apiFetch('/api/devices')
    devices.value = await res.json()
  }

  async function addDevice(device: CreateDevice) {
    const res = await apiFetch('/api/devices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(device),
    })
    if (res.ok) {
      await fetchDevices()
    }
  }

  function getById(id: string | undefined) {
    return devices.value.find(device => device.id === id)
  }

  async function deleteDevice(id: string) {
    const res = await apiFetch(`/api/devices/${id}`, { method: 'DELETE' })
    if (res.ok) {
      await fetchDevices()
    }
  }

  async function updateDevice(id: string, updatedDevice: UpdateDevice) {
    const res = await apiFetch(`/api/devices/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedDevice),
    })
    if (res.ok) {
      await fetchDevices()
    }
  }

  return { devices, fetchDevices, addDevice, deleteDevice, getById, updateDevice }
})
