import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { jsonResponse, stubFetch } from '../../test/fetch'
import { useScreensStore } from '../screens'

describe('screens store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('reorderScreens sends the ordered ids and stores the server-confirmed order', async () => {
    const mockFetch = stubFetch()
    const reordered = [{ id: 'b', order: 1 }, { id: 'a', order: 2 }]
    mockFetch.mockResolvedValue(jsonResponse(reordered))

    const store = useScreensStore()
    await store.reorderScreens('device-1', ['b', 'a'])

    expect(globalThis.fetch).toHaveBeenCalledWith('/api/screens/device/device-1/reorder', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ screenIds: ['b', 'a'] }),
    })
    expect(store.screens).toEqual(reordered)
  })

  it('reorderScreens refetches the device screens and throws on failure', async () => {
    const mockFetch = stubFetch()
    const serverScreens = [{ id: 'a', order: 1 }, { id: 'b', order: 2 }]
    mockFetch
      .mockResolvedValueOnce(jsonResponse(null, false))
      .mockResolvedValueOnce(jsonResponse(serverScreens))

    const store = useScreensStore()
    await expect(store.reorderScreens('device-1', ['b', 'a'])).rejects.toThrow('Failed to reorder screens')

    expect(globalThis.fetch).toHaveBeenCalledWith('/api/screens/device/device-1', undefined)
    expect(store.screens).toEqual(serverScreens)
  })
})
