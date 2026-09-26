import type { CreatePluginPayload, Plugin } from '@/types/plugin'
import { defineStore } from 'pinia'
import { apiFetch, apiRequest } from '../utils/apiRequest'

export const usePluginsStore = defineStore('plugins', () => {
  const fetchAllPlugins = async () => {
    const res = await apiFetch('/api/plugins')
    if (!res.ok)
      throw new Error('Failed to fetch plugins')
    return await res.json() as Plugin[]
  }

  const createPlugin = async (pluginData: CreatePluginPayload) => {
    return apiRequest<Plugin>('/api/plugins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pluginData),
    }, 'Failed to create plugin')
  }

  const updatePlugin = async (id: string, pluginData: Partial<CreatePluginPayload>) => {
    return apiRequest<Plugin>(`/api/plugins/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pluginData),
    }, 'Failed to update plugin')
  }

  const duplicatePlugin = async (id: string) => {
    return apiRequest<Plugin>(`/api/plugins/${id}/duplicate`, {
      method: 'POST',
    }, 'Failed to duplicate plugin')
  }

  const deletePlugin = async (id: string) => {
    const res = await apiFetch(`/api/plugins/${id}`, {
      method: 'DELETE',
    })
    if (!res.ok)
      throw new Error('Failed to delete plugin')
  }

  const assignToDevice = async (pluginId: string, deviceId: string, isActive = true, order = 0) => {
    const res = await apiFetch(`/api/plugins/${pluginId}/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, isActive, order }),
    })
    if (!res.ok)
      throw new Error('Failed to assign plugin')
    return await res.json()
  }

  const unassignFromDevice = async (pluginId: string, deviceId: string) => {
    const res = await apiFetch(`/api/plugins/${pluginId}/unassign/${deviceId}`, {
      method: 'DELETE',
    })
    if (!res.ok)
      throw new Error('Failed to unassign plugin')
  }

  return {
    fetchAllPlugins,
    createPlugin,
    updatePlugin,
    duplicatePlugin,
    deletePlugin,
    assignToDevice,
    unassignFromDevice,
  }
})
