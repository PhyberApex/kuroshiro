import type { Plugin } from '@/types/plugin'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { usePluginsStore } from '../plugins'

describe('plugins store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    globalThis.fetch = vi.fn()
  })

  const mockPlugin: Plugin = {
    id: 'plugin-1',
    name: 'Test Plugin',
    description: 'Test',
    kind: 'Poll',
    refreshInterval: 15,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  it('fetchPluginsForDevice fetches plugins for a device', async () => {
    const plugins = [mockPlugin]
    ;(globalThis.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => plugins,
    })

    const store = usePluginsStore()
    await store.fetchPluginsForDevice('device-1')

    expect(globalThis.fetch).toHaveBeenCalledWith('/api/plugins/device/device-1')
    expect(store.plugins).toEqual(plugins)
  })

  it('createPlugin creates a new plugin', async () => {
    const newPlugin = { ...mockPlugin, device: { id: 'device-1' } }
    ;(globalThis.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => newPlugin,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [newPlugin],
      })

    const store = usePluginsStore()
    const result = await store.createPlugin({ name: 'Test Plugin' })

    expect(globalThis.fetch).toHaveBeenCalledWith('/api/plugins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test Plugin' }),
    })
    expect(result).toEqual(newPlugin)
  })

  it('updatePlugin updates an existing plugin', async () => {
    const updatedPlugin = { ...mockPlugin, name: 'Updated Plugin' }
    ;(globalThis.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => updatedPlugin,
    })

    const store = usePluginsStore()
    const result = await store.updatePlugin('plugin-1', { name: 'Updated Plugin' })

    expect(globalThis.fetch).toHaveBeenCalledWith('/api/plugins/plugin-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Updated Plugin' }),
    })
    expect(result).toEqual(updatedPlugin)
  })

  it('deletePlugin deletes a plugin and refetches for device', async () => {
    ;(globalThis.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })

    const store = usePluginsStore()
    await store.deletePlugin('plugin-1', 'device-1')

    expect(globalThis.fetch).toHaveBeenCalledWith('/api/plugins/plugin-1', {
      method: 'DELETE',
    })
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/plugins/device/device-1')
  })

  it('assignToDevice assigns plugin to device', async () => {
    const assignment = { id: 'dp-1' }
    ;(globalThis.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => assignment,
    })

    const store = usePluginsStore()
    const result = await store.assignToDevice('plugin-1', 'device-1', true, 0)

    expect(globalThis.fetch).toHaveBeenCalledWith('/api/plugins/plugin-1/assign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: 'device-1', isActive: true, order: 0 }),
    })
    expect(result).toEqual(assignment)
  })

  it('unassignFromDevice unassigns plugin from device', async () => {
    ;(globalThis.fetch as any).mockResolvedValue({
      ok: true,
    })

    const store = usePluginsStore()
    await store.unassignFromDevice('plugin-1', 'device-1')

    expect(globalThis.fetch).toHaveBeenCalledWith('/api/plugins/plugin-1/unassign/device-1', {
      method: 'DELETE',
    })
  })

  it('updateDeviceAssignment updates device assignment', async () => {
    const updated = { id: 'dp-1', isActive: false }
    ;(globalThis.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => updated,
    })

    const store = usePluginsStore()
    const result = await store.updateDeviceAssignment('dp-1', { isActive: false })

    expect(globalThis.fetch).toHaveBeenCalledWith('/api/plugins/device-assignment/dp-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: false }),
    })
    expect(result).toEqual(updated)
  })

  it('throws error when fetch fails', async () => {
    ;(globalThis.fetch as any).mockResolvedValue({
      ok: false,
    })

    const store = usePluginsStore()

    await expect(store.fetchPluginsForDevice('device-1')).rejects.toThrow('Failed to fetch plugins')
  })
})
