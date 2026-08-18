import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useDeviceModelsStore } from '../deviceModels'

const OG_PLUS = { name: 'og_plus', label: 'TRMNL OG', width: 800, height: 480, paletteIds: ['bw', 'gray-4'], deprecated: false }
const OLD = { name: 'old', label: 'Old', width: 800, height: 480, paletteIds: ['bw'], deprecated: true }
const BW = { id: 'bw', name: 'Black & White (1-bit)', grays: 2 }
const GRAY_4 = { id: 'gray-4', name: '4 Grays (2-bit)', grays: 4 }

function jsonResponse(body: unknown, ok = true) {
  return { ok, statusText: ok ? 'OK' : 'Service Unavailable', json: async () => body }
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

  it('ensureLoaded fetches once', async () => {
    ;(globalThis.fetch as any).mockResolvedValue(jsonResponse([]))
    const store = useDeviceModelsStore()
    await store.ensureLoaded()
    await store.ensureLoaded()
    expect(globalThis.fetch).toHaveBeenCalledTimes(2)
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
})
