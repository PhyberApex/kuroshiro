import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { jsonResponse, stubFetch } from '../../test/fetch'
import { useAlertsStore } from '../alerts'

const ACTIVE_OFFLINE = { id: 'alert-1', kind: 'device-offline', deviceId: 'device-1', deviceName: 'Living Room', openedAt: '2026-01-10T00:00:00.000Z', resolvedAt: null, details: null }
const ACTIVE_LOW_BATTERY = { id: 'alert-2', kind: 'device-low-battery', deviceId: 'device-2', deviceName: 'Kitchen', openedAt: '2026-01-11T00:00:00.000Z', resolvedAt: null, details: { percent: 5 } }
const RESOLVED = { id: 'alert-3', kind: 'device-offline', deviceId: 'device-1', deviceName: 'Living Room', openedAt: '2026-01-01T00:00:00.000Z', resolvedAt: '2026-01-02T00:00:00.000Z', details: null }

describe('alerts store', () => {
  let mockFetch: ReturnType<typeof stubFetch>

  beforeEach(() => {
    setActivePinia(createPinia())
    mockFetch = stubFetch()
  })

  it('fetchAll loads active and resolved Alerts', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ active: [ACTIVE_OFFLINE, ACTIVE_LOW_BATTERY], resolved: [RESOLVED] }))
    const store = useAlertsStore()

    await store.fetchAll()

    expect(fetch).toHaveBeenCalledWith('/api/alerts', undefined)
    expect(store.active).toEqual([ACTIVE_OFFLINE, ACTIVE_LOW_BATTERY])
    expect(store.resolved).toEqual([RESOLVED])
    expect(store.loaded).toBe(true)
    expect(store.error).toBeNull()
  })

  it('ensureLoaded dedupes concurrent calls into a single fetch', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ active: [], resolved: [] }))
    const store = useAlertsStore()

    await Promise.all([store.ensureLoaded(), store.ensureLoaded(), store.ensureLoaded()])

    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('fetchAll records the error and leaves the store not-loaded when the request fails', async () => {
    mockFetch.mockResolvedValue(jsonResponse(null, { ok: false, status: 500, statusText: 'Internal Server Error' }))
    const store = useAlertsStore()

    await store.fetchAll()

    expect(store.loaded).toBe(false)
    expect(store.error).toBe('Failed to load Alerts: Internal Server Error')
  })

  it('activeForDevice filters the active list by Device id', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ active: [ACTIVE_OFFLINE, ACTIVE_LOW_BATTERY], resolved: [] }))
    const store = useAlertsStore()
    await store.fetchAll()

    expect(store.activeForDevice('device-1')).toEqual([ACTIVE_OFFLINE])
    expect(store.activeForDevice('device-3')).toEqual([])
  })

  describe('sendTestNotification', () => {
    it('returns ok with the API message on success', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ message: 'Test notification sent successfully.' }))
      const store = useAlertsStore()

      const result = await store.sendTestNotification()

      expect(fetch).toHaveBeenCalledWith('/api/alerts/test-notification', { method: 'POST' })
      expect(result).toEqual({ ok: true, message: 'Test notification sent successfully.' })
    })

    it('returns not-ok with the API message on failure', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ message: 'Apprise is not configured — set KUROSHIRO_APPRISE_URL to enable notifications.' }, false))
      const store = useAlertsStore()

      const result = await store.sendTestNotification()

      expect(result).toEqual({ ok: false, message: 'Apprise is not configured — set KUROSHIRO_APPRISE_URL to enable notifications.' })
    })

    it('tracks a loading flag while the request is in flight', async () => {
      let resolveFetch: (response: Response) => void = () => {}
      mockFetch.mockImplementationOnce(() => new Promise((resolve) => {
        resolveFetch = resolve
      }))
      const store = useAlertsStore()

      const pending = store.sendTestNotification()
      expect(store.sendingTestNotification).toBe(true)

      resolveFetch(jsonResponse({ message: 'Test notification sent successfully.' }))
      await pending

      expect(store.sendingTestNotification).toBe(false)
    })
  })
})
