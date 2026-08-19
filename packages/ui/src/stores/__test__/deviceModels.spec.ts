import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useDeviceModelsStore } from '../deviceModels'

const OG_PLUS = { name: 'og_plus', label: 'TRMNL OG', width: 800, height: 480, paletteIds: ['bw', 'gray-4'], deprecated: false }
const OLD = { name: 'old', label: 'Old', width: 800, height: 480, paletteIds: ['bw'], deprecated: true }
const BW = { id: 'bw', name: 'Black & White (1-bit)', grays: 2 }
const GRAY_4 = { id: 'gray-4', name: '4 Grays (2-bit)', grays: 4 }

function jsonResponse(body: unknown, ok = true) {
  return { ok, status: ok ? 200 : 503, statusText: ok ? 'OK' : 'Service Unavailable', json: async () => body }
}

describe('deviceModels store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    globalThis.fetch = vi.fn()
  })

  it('fetchAll loads models and palettes and exposes only active models', async () => {
    ;(globalThis.fetch as any).mockImplementation(async (url: string) =>
      url.endsWith('/palettes') ? jsonResponse([BW, GRAY_4]) : jsonResponse([OG_PLUS, OLD]))
    const store = useDeviceModelsStore()
    await store.fetchAll()
    expect(store.models).toHaveLength(2)
    expect(store.activeModels).toEqual([OG_PLUS])
    expect(store.palettes).toEqual([BW, GRAY_4])
    expect(store.loaded).toBe(true)
  })

  it('ensureLoaded only fetches on the first call once loaded', async () => {
    ;(globalThis.fetch as any).mockResolvedValue(jsonResponse([]))
    const store = useDeviceModelsStore()
    await store.ensureLoaded()
    await store.ensureLoaded()
    expect(globalThis.fetch).toHaveBeenCalledTimes(2)
  })

  it('ensureLoaded dedupes concurrent calls into a single fetchAll', async () => {
    ;(globalThis.fetch as any).mockResolvedValue(jsonResponse([]))
    const store = useDeviceModelsStore()
    await Promise.all([store.ensureLoaded(), store.ensureLoaded(), store.ensureLoaded()])
    expect(globalThis.fetch).toHaveBeenCalledTimes(2)
  })

  it('fetchAll records the status and statusText when a response is not ok', async () => {
    ;(globalThis.fetch as any).mockImplementation(async (url: string) =>
      url.endsWith('/palettes') ? jsonResponse([BW, GRAY_4]) : jsonResponse(null, false))
    const store = useDeviceModelsStore()
    await store.fetchAll()
    expect(store.loaded).toBe(false)
    expect(store.error).toBe('503 Service Unavailable')
  })

  it('fetchAll clears a previous error on a later successful load', async () => {
    const store = useDeviceModelsStore()
    ;(globalThis.fetch as any).mockResolvedValue(jsonResponse(null, false))
    await store.fetchAll()
    expect(store.error).not.toBeNull()

    ;(globalThis.fetch as any).mockImplementation(async (url: string) =>
      url.endsWith('/palettes') ? jsonResponse([BW]) : jsonResponse([OG_PLUS]))
    await store.fetchAll()
    expect(store.error).toBeNull()
    expect(store.loaded).toBe(true)
  })

  it('palettesFor returns the palettes a model allows, in the model order', async () => {
    ;(globalThis.fetch as any).mockImplementation(async (url: string) =>
      url.endsWith('/palettes') ? jsonResponse([GRAY_4, BW]) : jsonResponse([OG_PLUS]))
    const store = useDeviceModelsStore()
    await store.fetchAll()
    expect(store.palettesFor(store.getByName('og_plus'))).toEqual([BW, GRAY_4])
    expect(store.palettesFor(undefined)).toEqual([])
  })

  it('sync posts to the sync endpoint and refreshes the lists', async () => {
    const result = { models: 1, palettes: 2, deprecatedModels: 0, deprecatedPalettes: 0, syncedAt: '2026-08-18T00:00:00.000Z' }
    ;(globalThis.fetch as any).mockImplementation(async (url: string, init?: RequestInit) => {
      if (init?.method === 'POST')
        return jsonResponse(result)
      return url.endsWith('/palettes') ? jsonResponse([BW]) : jsonResponse([OG_PLUS])
    })
    const store = useDeviceModelsStore()
    await expect(store.sync()).resolves.toEqual(result)
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/device-models/sync', { method: 'POST' })
    expect(store.models).toEqual([OG_PLUS])
    expect(store.error).toBeNull()
  })

  it('sync records the server error message and returns null on failure', async () => {
    ;(globalThis.fetch as any).mockResolvedValue(jsonResponse({ message: 'Could not sync device models from TRMNL: boom' }, false))
    const store = useDeviceModelsStore()
    await expect(store.sync()).resolves.toBeNull()
    expect(store.error).toBe('Could not sync device models from TRMNL: boom')
    expect(store.syncing).toBe(false)
  })

  it('fetchAll records a network failure instead of throwing', async () => {
    ;(globalThis.fetch as any).mockRejectedValue(new TypeError('Failed to fetch'))
    const store = useDeviceModelsStore()
    await expect(store.fetchAll()).resolves.toBeUndefined()
    expect(store.loaded).toBe(false)
    expect(store.error).toBe('Failed to fetch')
  })
})
