import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { jsonResponse, stubFetch } from '../../test/fetch'
import { useDeviceModelsStore } from '../deviceModels'

const OG_PLUS = { name: 'og_plus', label: 'TRMNL OG', width: 800, height: 480, paletteIds: ['bw', 'gray-4'], deprecated: false }
const OLD = { name: 'old', label: 'Old', width: 800, height: 480, paletteIds: ['bw'], deprecated: true }
const BW = { id: 'bw', name: 'Black & White (1-bit)', grays: 2 }
const GRAY_4 = { id: 'gray-4', name: '4 Grays (2-bit)', grays: 4 }

describe('deviceModels store', () => {
  let mockFetch: ReturnType<typeof stubFetch>

  beforeEach(() => {
    setActivePinia(createPinia())
    mockFetch = stubFetch()
  })

  it('fetchAll loads models and palettes and exposes only active models', async () => {
    mockFetch.mockImplementation(async url =>
      String(url).endsWith('/palettes') ? jsonResponse([BW, GRAY_4]) : jsonResponse([OG_PLUS, OLD]))
    const store = useDeviceModelsStore()
    await store.fetchAll()
    expect(store.models).toHaveLength(2)
    expect(store.activeModels).toEqual([OG_PLUS])
    expect(store.palettes).toEqual([BW, GRAY_4])
    expect(store.loaded).toBe(true)
  })

  it('ensureLoaded only fetches on the first call once loaded', async () => {
    // A real `Response` body can only be read once — `fetchAll` reads both the
    // models and palettes responses, so each `fetch()` call needs its own instance.
    mockFetch.mockImplementation(async () => jsonResponse([]))
    const store = useDeviceModelsStore()
    await store.ensureLoaded()
    await store.ensureLoaded()
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('ensureLoaded dedupes concurrent calls into a single fetchAll', async () => {
    mockFetch.mockImplementation(async () => jsonResponse([]))
    const store = useDeviceModelsStore()
    await Promise.all([store.ensureLoaded(), store.ensureLoaded(), store.ensureLoaded()])
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('fetchAll records the status and statusText when a response is not ok', async () => {
    mockFetch.mockImplementation(async url =>
      String(url).endsWith('/palettes') ? jsonResponse([BW, GRAY_4]) : jsonResponse(null, { status: 503, statusText: 'Service Unavailable' }))
    const store = useDeviceModelsStore()
    await store.fetchAll()
    expect(store.loaded).toBe(false)
    expect(store.error).toBe('503 Service Unavailable')
  })

  it('fetchAll clears a previous error on a later successful load', async () => {
    const store = useDeviceModelsStore()
    mockFetch.mockResolvedValue(jsonResponse(null, { status: 503, statusText: 'Service Unavailable' }))
    await store.fetchAll()
    expect(store.error).not.toBeNull()

    mockFetch.mockImplementation(async url =>
      String(url).endsWith('/palettes') ? jsonResponse([BW]) : jsonResponse([OG_PLUS]))
    await store.fetchAll()
    expect(store.error).toBeNull()
    expect(store.loaded).toBe(true)
  })

  it('palettesFor returns the palettes a model allows, in the model order', async () => {
    mockFetch.mockImplementation(async url =>
      String(url).endsWith('/palettes') ? jsonResponse([GRAY_4, BW]) : jsonResponse([OG_PLUS]))
    const store = useDeviceModelsStore()
    await store.fetchAll()
    expect(store.palettesFor(store.getByName('og_plus'))).toEqual([BW, GRAY_4])
    expect(store.palettesFor(undefined)).toEqual([])
  })

  it('sync posts to the sync endpoint and refreshes the lists', async () => {
    const result = { models: 1, palettes: 2, deprecatedModels: 0, deprecatedPalettes: 0, syncedAt: '2026-08-18T00:00:00.000Z' }
    mockFetch.mockImplementation(async (url, init) => {
      if (init?.method === 'POST')
        return jsonResponse(result)
      return String(url).endsWith('/palettes') ? jsonResponse([BW]) : jsonResponse([OG_PLUS])
    })
    const store = useDeviceModelsStore()
    await expect(store.sync()).resolves.toEqual(result)
    expect(mockFetch).toHaveBeenCalledWith('/api/device-models/sync', { method: 'POST' })
    expect(store.models).toEqual([OG_PLUS])
    expect(store.error).toBeNull()
  })

  it('sync records the server error message and returns null on failure', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ message: 'Could not sync device models from TRMNL: boom' }, false))
    const store = useDeviceModelsStore()
    await expect(store.sync()).resolves.toBeNull()
    expect(store.error).toBe('Could not sync device models from TRMNL: boom')
    expect(store.syncing).toBe(false)
  })

  it('fetchAll records a network failure instead of throwing', async () => {
    mockFetch.mockRejectedValue(new TypeError('Failed to fetch'))
    const store = useDeviceModelsStore()
    await expect(store.fetchAll()).resolves.toBeUndefined()
    expect(store.loaded).toBe(false)
    expect(store.error).toBe('Failed to fetch')
  })
})
