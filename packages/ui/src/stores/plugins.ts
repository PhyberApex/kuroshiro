import type { Plugin } from '@/types/plugin'
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const usePluginsStore = defineStore('plugins', () => {
  const plugins = ref<Plugin[]>([])

  const fetchPluginsForDevice = async (deviceId: string) => {
    const res = await fetch(`/api/plugins/device/${deviceId}`)
    if (!res.ok)
      throw new Error('Failed to fetch plugins')
    plugins.value = await res.json()
  }

  const createPlugin = async (pluginData: Partial<Plugin>) => {
    const res = await fetch('/api/plugins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pluginData),
    })
    if (!res.ok)
      throw new Error('Failed to create plugin')
    const newPlugin = await res.json()
    if (newPlugin.device?.id) {
      await fetchPluginsForDevice(newPlugin.device.id)
    }
    return newPlugin
  }

  const updatePlugin = async (id: string, pluginData: Partial<Plugin>) => {
    const res = await fetch(`/api/plugins/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pluginData),
    })
    if (!res.ok)
      throw new Error('Failed to update plugin')
    const updatedPlugin = await res.json()
    if (updatedPlugin.device?.id) {
      await fetchPluginsForDevice(updatedPlugin.device.id)
    }
    return updatedPlugin
  }

  const deletePlugin = async (id: string, deviceId?: string) => {
    const res = await fetch(`/api/plugins/${id}`, {
      method: 'DELETE',
    })
    if (!res.ok)
      throw new Error('Failed to delete plugin')
    if (deviceId) {
      await fetchPluginsForDevice(deviceId)
    }
  }

  const testPlugin = async (id: string) => {
    const res = await fetch(`/api/plugins/${id}/test`, {
      method: 'POST',
    })
    if (!res.ok)
      throw new Error('Failed to test plugin')
    return await res.json()
  }

  const assignToDevice = async (pluginId: string, deviceId: string, isActive = true, order = 0) => {
    const res = await fetch(`/api/plugins/${pluginId}/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, isActive, order }),
    })
    if (!res.ok)
      throw new Error('Failed to assign plugin')
    return await res.json()
  }

  const unassignFromDevice = async (pluginId: string, deviceId: string) => {
    const res = await fetch(`/api/plugins/${pluginId}/unassign/${deviceId}`, {
      method: 'DELETE',
    })
    if (!res.ok)
      throw new Error('Failed to unassign plugin')
  }

  const updateDeviceAssignment = async (devicePluginId: string, updates: { isActive?: boolean, order?: number }) => {
    const res = await fetch(`/api/plugins/device-assignment/${devicePluginId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    if (!res.ok)
      throw new Error('Failed to update assignment')
    return await res.json()
  }

  return {
    plugins,
    fetchPluginsForDevice,
    createPlugin,
    updatePlugin,
    deletePlugin,
    testPlugin,
    assignToDevice,
    unassignFromDevice,
    updateDeviceAssignment,
  }
})
