import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { jsonResponse, stubFetch } from '../../test/fetch'
import { usePluginsStore } from '../plugins'

describe('plugins store', () => {
  let mockFetch: ReturnType<typeof stubFetch>

  beforeEach(() => {
    setActivePinia(createPinia())
    mockFetch = stubFetch()
  })

  // Wire-format shape: `createdAt`/`updatedAt` are typed `Date` on `Plugin`, but a real
  // response only ever carries ISO strings — these tests round-trip through a real
  // `Response`, so match that instead of the `Plugin` type's client-side shape.
  const mockPlugin = {
    id: 'plugin-1',
    name: 'Test Plugin',
    description: 'Test',
    kind: 'Poll',
    refreshInterval: 15,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }

  it('fetchPluginsForDevice fetches plugins for a device', async () => {
    const plugins = [mockPlugin]
    mockFetch.mockResolvedValue(jsonResponse(plugins))

    const store = usePluginsStore()
    await store.fetchPluginsForDevice('device-1')

    expect(mockFetch).toHaveBeenCalledWith('/api/plugins/device/device-1')
    expect(store.plugins).toEqual(plugins)
  })

  it('createPlugin creates a new plugin', async () => {
    const newPlugin = { ...mockPlugin, device: { id: 'device-1' } }
    mockFetch
      .mockResolvedValueOnce(jsonResponse(newPlugin))
      .mockResolvedValueOnce(jsonResponse([newPlugin]))

    const store = usePluginsStore()
    const result = await store.createPlugin({ name: 'Test Plugin' })

    expect(mockFetch).toHaveBeenCalledWith('/api/plugins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test Plugin' }),
    })
    expect(result).toEqual(newPlugin)
  })

  it('updatePlugin updates an existing plugin', async () => {
    const updatedPlugin = { ...mockPlugin, name: 'Updated Plugin' }
    mockFetch.mockResolvedValue(jsonResponse(updatedPlugin))

    const store = usePluginsStore()
    const result = await store.updatePlugin('plugin-1', { name: 'Updated Plugin' })

    expect(mockFetch).toHaveBeenCalledWith('/api/plugins/plugin-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Updated Plugin' }),
    })
    expect(result).toEqual(updatedPlugin)
  })

  it('deletePlugin deletes a plugin and refetches for device', async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse(null))
      .mockResolvedValueOnce(jsonResponse([]))

    const store = usePluginsStore()
    await store.deletePlugin('plugin-1', 'device-1')

    expect(mockFetch).toHaveBeenCalledWith('/api/plugins/plugin-1', {
      method: 'DELETE',
    })
    expect(mockFetch).toHaveBeenCalledWith('/api/plugins/device/device-1')
  })

  it('assignToDevice assigns plugin to device', async () => {
    const assignment = { id: 'dp-1' }
    mockFetch.mockResolvedValue(jsonResponse(assignment))

    const store = usePluginsStore()
    const result = await store.assignToDevice('plugin-1', 'device-1', true, 0)

    expect(mockFetch).toHaveBeenCalledWith('/api/plugins/plugin-1/assign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: 'device-1', isActive: true, order: 0 }),
    })
    expect(result).toEqual(assignment)
  })

  it('unassignFromDevice unassigns plugin from device', async () => {
    mockFetch.mockResolvedValue(jsonResponse(null))

    const store = usePluginsStore()
    await store.unassignFromDevice('plugin-1', 'device-1')

    expect(mockFetch).toHaveBeenCalledWith('/api/plugins/plugin-1/unassign/device-1', {
      method: 'DELETE',
    })
  })

  it('updateDeviceAssignment updates device assignment', async () => {
    const updated = { id: 'dp-1', isActive: false }
    mockFetch.mockResolvedValue(jsonResponse(updated))

    const store = usePluginsStore()
    const result = await store.updateDeviceAssignment('dp-1', { isActive: false })

    expect(mockFetch).toHaveBeenCalledWith('/api/plugins/device-assignment/dp-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: false }),
    })
    expect(result).toEqual(updated)
  })

  it('throws error when fetch fails', async () => {
    mockFetch.mockResolvedValue(jsonResponse(null, false))

    const store = usePluginsStore()

    await expect(store.fetchPluginsForDevice('device-1')).rejects.toThrow('Failed to fetch plugins')
  })

  it('createPlugin surfaces the server\'s validation message on failure', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ message: 'Data source name "trmnl" is reserved' }, false))

    const store = usePluginsStore()

    await expect(store.createPlugin({ name: 'Test Plugin' })).rejects.toThrow('Data source name "trmnl" is reserved')
  })

  it('updatePlugin surfaces the server\'s validation message on failure', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ message: 'Data source name "weather" is used by more than one data source' }, false))

    const store = usePluginsStore()

    await expect(store.updatePlugin('plugin-1', { name: 'Updated' })).rejects.toThrow('used by more than one data source')
  })
})
