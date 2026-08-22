import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useFirmwareStore } from '../firmware'

const OFFICIAL = { id: 'fw-1', version: '1.5.6', kind: 'official-synced', compatibleModels: ['og_png', 'og_plus', 'og_bwry'], deprecated: false }
const CUSTOM_UNIVERSAL = { id: 'fw-2', version: '1.0.0', kind: 'custom', compatibleModels: [], deprecated: false }
const CUSTOM_V2 = { id: 'fw-3', version: '2.0.0', kind: 'custom', compatibleModels: ['v2'], deprecated: false }
const DEPRECATED = { id: 'fw-0', version: '1.5.5', kind: 'official-synced', compatibleModels: ['og_png'], deprecated: true }

function jsonResponse(body: unknown, ok = true) {
  return { ok, status: ok ? 200 : 503, statusText: ok ? 'OK' : 'Service Unavailable', json: async () => body }
}

describe('firmware store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    globalThis.fetch = vi.fn()
  })

  it('fetchAll loads firmware and exposes only active rows', async () => {
    ;(globalThis.fetch as any).mockResolvedValue(jsonResponse([OFFICIAL, DEPRECATED]))
    const store = useFirmwareStore()
    await store.fetchAll()
    expect(store.firmware).toHaveLength(2)
    expect(store.activeFirmware).toEqual([OFFICIAL])
    expect(store.loaded).toBe(true)
  })

  it('ensureLoaded dedupes concurrent calls into a single fetchAll', async () => {
    ;(globalThis.fetch as any).mockResolvedValue(jsonResponse([]))
    const store = useFirmwareStore()
    await Promise.all([store.ensureLoaded(), store.ensureLoaded(), store.ensureLoaded()])
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
  })

  it('fetchAll records the status and statusText when a response is not ok', async () => {
    ;(globalThis.fetch as any).mockResolvedValue(jsonResponse(null, false))
    const store = useFirmwareStore()
    await store.fetchAll()
    expect(store.loaded).toBe(false)
    expect(store.error).toBe('503 Service Unavailable')
  })

  it('compatibleWith returns universal and model-matching firmware, excluding other models and deprecated rows', async () => {
    ;(globalThis.fetch as any).mockResolvedValue(jsonResponse([OFFICIAL, CUSTOM_UNIVERSAL, CUSTOM_V2, DEPRECATED]))
    const store = useFirmwareStore()
    await store.fetchAll()
    expect(store.compatibleWith('og_plus')).toEqual([OFFICIAL, CUSTOM_UNIVERSAL])
    expect(store.compatibleWith('v2')).toEqual([CUSTOM_UNIVERSAL, CUSTOM_V2])
    expect(store.compatibleWith(null)).toEqual([CUSTOM_UNIVERSAL])
  })

  it('getById finds a firmware row by id', async () => {
    ;(globalThis.fetch as any).mockResolvedValue(jsonResponse([OFFICIAL]))
    const store = useFirmwareStore()
    await store.fetchAll()
    expect(store.getById('fw-1')).toEqual(OFFICIAL)
    expect(store.getById(undefined)).toBeUndefined()
  })

  it('sync posts to the sync endpoint and refreshes the list', async () => {
    const result = { inserted: true, version: '1.5.7' }
    ;(globalThis.fetch as any).mockImplementation(async (url: string, init?: RequestInit) =>
      init?.method === 'POST' ? jsonResponse(result) : jsonResponse([OFFICIAL]))
    const store = useFirmwareStore()
    await expect(store.sync()).resolves.toEqual(result)
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/firmware/sync', { method: 'POST' })
    expect(store.firmware).toEqual([OFFICIAL])
  })

  it('sync records the server error message and returns null on failure', async () => {
    ;(globalThis.fetch as any).mockResolvedValue(jsonResponse({ message: 'Could not sync firmware from TRMNL: boom' }, false))
    const store = useFirmwareStore()
    await expect(store.sync()).resolves.toBeNull()
    expect(store.error).toBe('Could not sync firmware from TRMNL: boom')
    expect(store.syncing).toBe(false)
  })

  it('upload posts multipart form data and refreshes the list', async () => {
    let capturedBody: FormData | undefined
    ;(globalThis.fetch as any).mockImplementation(async (url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        capturedBody = init.body as FormData
        return jsonResponse({ id: 'fw-2' })
      }
      return jsonResponse([CUSTOM_UNIVERSAL])
    })
    const store = useFirmwareStore()
    const file = new File(['binary'], 'og.bin')
    const result = await store.upload(file, '1.0.0', 'My Label', ['og_plus'])
    expect(result).toBe(true)
    expect(capturedBody?.get('version')).toBe('1.0.0')
    expect(capturedBody?.get('label')).toBe('My Label')
    expect(capturedBody?.get('compatibleModels')).toBe('["og_plus"]')
    expect(store.firmware).toEqual([CUSTOM_UNIVERSAL])
  })

  it('upload records the server error and returns false on failure', async () => {
    ;(globalThis.fetch as any).mockResolvedValue(jsonResponse({ message: 'Firmware upload must be a .bin file' }, false))
    const store = useFirmwareStore()
    const file = new File(['binary'], 'og.zip')
    await expect(store.upload(file, '1.0.0')).resolves.toBe(false)
    expect(store.error).toBe('Firmware upload must be a .bin file')
    expect(store.uploading).toBe(false)
  })

  it('remove deletes a firmware and refreshes the list', async () => {
    ;(globalThis.fetch as any).mockImplementation(async (url: string, init?: RequestInit) =>
      init?.method === 'DELETE' ? jsonResponse({}) : jsonResponse([]))
    const store = useFirmwareStore()
    await expect(store.remove('fw-2')).resolves.toBe(true)
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/firmware/fw-2', { method: 'DELETE' })
  })

  it('remove records the server error and returns false on failure', async () => {
    ;(globalThis.fetch as any).mockResolvedValue(jsonResponse({ message: 'Only custom firmware can be deleted' }, false))
    const store = useFirmwareStore()
    await expect(store.remove('fw-1')).resolves.toBe(false)
    expect(store.error).toBe('Only custom firmware can be deleted')
  })
})
