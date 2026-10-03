import type { InstanceSettingsResponse } from 'kuroshiro-shared'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { jsonResponse, stubFetch } from '../../test/fetch'
import { useSettingsStore } from '../settings'

const SETTINGS: InstanceSettingsResponse = {
  lowBatteryPercent: { override: null, value: 20, fallbackSource: 'default', fallbackValue: 20 },
  offlineMultiplier: { override: null, value: 3, fallbackSource: 'default', fallbackValue: 3 },
  fetchFailureThreshold: { override: null, value: 3, fallbackSource: 'default', fallbackValue: 3 },
  alertRetentionDays: { override: null, value: 90, fallbackSource: 'default', fallbackValue: 90 },
  deviceLogRetentionDays: { override: null, value: 30, fallbackSource: 'default', fallbackValue: 30 },
  firmwareAutoUpdate: { override: null, value: false, fallbackSource: 'default', fallbackValue: false },
}

describe('settings store', () => {
  let mockFetch: ReturnType<typeof stubFetch>

  beforeEach(() => {
    setActivePinia(createPinia())
    mockFetch = stubFetch()
  })

  it('fetchAll loads Instance Settings', async () => {
    mockFetch.mockResolvedValue(jsonResponse(SETTINGS))
    const store = useSettingsStore()

    await store.fetchAll()

    expect(fetch).toHaveBeenCalledWith('/api/settings', undefined)
    expect(store.settings).toEqual(SETTINGS)
    expect(store.loaded).toBe(true)
    expect(store.error).toBeNull()
  })

  it('ensureLoaded dedupes concurrent calls into a single fetch', async () => {
    mockFetch.mockResolvedValue(jsonResponse(SETTINGS))
    const store = useSettingsStore()

    await Promise.all([store.ensureLoaded(), store.ensureLoaded(), store.ensureLoaded()])

    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('fetchAll records the error and leaves the store not-loaded when the request fails', async () => {
    mockFetch.mockResolvedValue(jsonResponse(null, { ok: false, status: 500, statusText: 'Internal Server Error' }))
    const store = useSettingsStore()

    await store.fetchAll()

    expect(store.loaded).toBe(false)
    expect(store.error).toBe('Failed to load Settings: Internal Server Error')
  })

  describe('update', () => {
    it('saves and replaces the store\'s Settings with the response on success', async () => {
      const updated = { ...SETTINGS, lowBatteryPercent: { override: 15, value: 15, fallbackSource: 'default' as const, fallbackValue: 20 } }
      mockFetch.mockResolvedValue(jsonResponse(updated))
      const store = useSettingsStore()

      const result = await store.update({ lowBatteryPercent: 15 })

      expect(fetch).toHaveBeenCalledWith('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lowBatteryPercent: 15 }),
      })
      expect(result).toEqual({ ok: true })
      expect(store.settings).toEqual(updated)
      expect(store.error).toBeNull()
    })

    it('joins a class-validator style array message, returns not-ok, and records the error on a 400', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ message: ['lowBatteryPercent must not be greater than 100'] }, { ok: false, status: 400 }))
      const store = useSettingsStore()

      const result = await store.update({ lowBatteryPercent: 500 })

      expect(result).toEqual({ ok: false, message: 'lowBatteryPercent must not be greater than 100' })
      expect(store.error).toBe('lowBatteryPercent must not be greater than 100')
    })

    it('tracks a saving flag while the request is in flight', async () => {
      let resolveFetch: (response: Response) => void = () => {}
      mockFetch.mockImplementationOnce(() => new Promise((resolve) => {
        resolveFetch = resolve
      }))
      const store = useSettingsStore()

      const pending = store.update({ lowBatteryPercent: 15 })
      expect(store.saving).toBe(true)

      resolveFetch(jsonResponse(SETTINGS))
      await pending

      expect(store.saving).toBe(false)
    })
  })
})
