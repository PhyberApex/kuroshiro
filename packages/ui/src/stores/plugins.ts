import type { CreatePluginPayload, Plugin } from '@/types/plugin'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { apiRequest } from '../utils/apiRequest'

export const usePluginsStore = defineStore('plugins', () => {
  const plugins = ref<Plugin[]>([])

  const fetchPluginsForDevice = async (deviceId: string) => {
    const res = await fetch(`/api/plugins/device/${deviceId}`)
    if (!res.ok)
      throw new Error('Failed to fetch plugins')
    plugins.value = await res.json()
  }

  const createPlugin = async (pluginData: CreatePluginPayload) => {
    const newPlugin = await apiRequest<Plugin & { device?: { id: string } }>('/api/plugins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pluginData),
    }, 'Failed to create plugin')
    if (newPlugin.device?.id) {
      await fetchPluginsForDevice(newPlugin.device.id)
    }
    return newPlugin
  }

  const updatePlugin = async (id: string, pluginData: Partial<CreatePluginPayload>) => {
    const updatedPlugin = await apiRequest<Plugin & { device?: { id: string } }>(`/api/plugins/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pluginData),
    }, 'Failed to update plugin')
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
    assignToDevice,
    unassignFromDevice,
    updateDeviceAssignment,
  }
})
