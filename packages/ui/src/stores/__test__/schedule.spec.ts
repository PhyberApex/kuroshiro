import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useScheduleStore } from '../schedule'

function jsonResponse(body: unknown, ok = true) {
  return { ok, json: async () => body }
}

describe('schedule store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    globalThis.fetch = vi.fn()
  })

  it('creates a schedule on the screen', async () => {
    ;(globalThis.fetch as any).mockResolvedValue(jsonResponse({ id: 'schedule-1', enabled: true }))
    const store = useScheduleStore()

    const result = await store.create('screen-1', { weekdays: [1, 2] })

    expect(globalThis.fetch).toHaveBeenCalledWith('/api/screens/screen-1/schedule', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ weekdays: [1, 2] }),
    }))
    expect(result).toEqual({ id: 'schedule-1', enabled: true })
  })

  it('updates a schedule on the screen', async () => {
    ;(globalThis.fetch as any).mockResolvedValue(jsonResponse({ id: 'schedule-1', enabled: false }))
    const store = useScheduleStore()

    const result = await store.update('screen-1', { enabled: false })

    expect(globalThis.fetch).toHaveBeenCalledWith('/api/screens/screen-1/schedule', expect.objectContaining({ method: 'PATCH' }))
    expect(result).toEqual({ id: 'schedule-1', enabled: false })
  })

  it('deletes a schedule from the screen', async () => {
    ;(globalThis.fetch as any).mockResolvedValue(jsonResponse(null))
    const store = useScheduleStore()

    await store.remove('screen-1')

    expect(globalThis.fetch).toHaveBeenCalledWith('/api/screens/screen-1/schedule', { method: 'DELETE' })
  })

  it('surfaces the API error message when a save is rejected', async () => {
    ;(globalThis.fetch as any).mockResolvedValue(jsonResponse({ message: 'Screen already has a schedule' }, false))
    const store = useScheduleStore()

    await expect(store.create('screen-1', {})).rejects.toThrow('Screen already has a schedule')
  })

  it('joins the field-level validation messages the API returns', async () => {
    ;(globalThis.fetch as any).mockResolvedValue(jsonResponse({ message: ['startTime must be a HH:MM time of day', 'weekdays must be an array'] }, false))
    const store = useScheduleStore()

    await expect(store.update('screen-1', { startTime: 'nope' })).rejects.toThrow('startTime must be a HH:MM time of day, weekdays must be an array')
  })

  it('falls back to a generic message when the error body is unreadable', async () => {
    ;(globalThis.fetch as any).mockResolvedValue({
      ok: false,
      json: async () => {
        throw new Error('not json')
      },
    })
    const store = useScheduleStore()

    await expect(store.remove('screen-1')).rejects.toThrow('Failed to delete schedule')
  })
})
