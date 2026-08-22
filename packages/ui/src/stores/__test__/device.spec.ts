import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useDeviceStore } from '../device'

function jsonResponse(body: unknown, ok = true) {
  return { ok, status: ok ? 200 : 503, statusText: ok ? 'OK' : 'Service Unavailable', json: async () => body }
}

describe('device store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    globalThis.fetch = vi.fn()
  })

  it('updateDevice resolves true and refetches devices on success', async () => {
    ;(globalThis.fetch as any).mockResolvedValue(jsonResponse([]))
    const store = useDeviceStore()
    const result = await store.updateDevice('device1', { name: 'New name' })
    expect(result).toBe(true)
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/devices')
  })

  it('updateDevice resolves false and does not refetch on failure', async () => {
    ;(globalThis.fetch as any).mockResolvedValue(jsonResponse(null, false))
    const store = useDeviceStore()
    const result = await store.updateDevice('device1', { name: 'New name' })
    expect(result).toBe(false)
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
  })
})
