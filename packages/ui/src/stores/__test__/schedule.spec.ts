import type { Mock } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { jsonResponse, stubFetch } from '../../test/fetch'
import { useScheduleStore } from '../schedule'

describe('schedule store', () => {
  let mockFetch: Mock<typeof fetch>

  beforeEach(() => {
    setActivePinia(createPinia())
    mockFetch = stubFetch()
  })

  it('creates a schedule on the screen', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ id: 'schedule-1', enabled: true }))
    const store = useScheduleStore()

    const result = await store.create('screen-1', { weekdays: [1, 2] })

    expect(globalThis.fetch).toHaveBeenCalledWith('/api/screens/screen-1/schedule', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ weekdays: [1, 2] }),
    }))
    expect(result).toEqual({ id: 'schedule-1', enabled: true })
  })

  it('updates a schedule on the screen', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ id: 'schedule-1', enabled: false }))
    const store = useScheduleStore()

    const result = await store.update('screen-1', { enabled: false })

    expect(globalThis.fetch).toHaveBeenCalledWith('/api/screens/screen-1/schedule', expect.objectContaining({ method: 'PATCH' }))
    expect(result).toEqual({ id: 'schedule-1', enabled: false })
  })

  it('deletes a schedule from the screen', async () => {
    mockFetch.mockResolvedValue(jsonResponse(null))
    const store = useScheduleStore()

    await store.remove('screen-1')

    expect(globalThis.fetch).toHaveBeenCalledWith('/api/screens/screen-1/schedule', { method: 'DELETE' })
  })

  it('surfaces the API error message when a save is rejected', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ message: 'Screen already has a schedule' }, false))
    const store = useScheduleStore()

    await expect(store.create('screen-1', {})).rejects.toThrow('Screen already has a schedule')
  })

  it('joins the field-level validation messages the API returns', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ message: ['startTime must be a HH:MM time of day', 'weekdays must be an array'] }, false))
    const store = useScheduleStore()

    await expect(store.update('screen-1', { startTime: 'nope' })).rejects.toThrow('startTime must be a HH:MM time of day, weekdays must be an array')
  })

  it('falls back to a generic message when the error body is unreadable', async () => {
    mockFetch.mockResolvedValue(new Response('not json', { status: 500 }))
    const store = useScheduleStore()

    await expect(store.remove('screen-1')).rejects.toThrow('Failed to delete schedule')
  })
})
