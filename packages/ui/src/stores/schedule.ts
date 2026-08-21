import type { Schedule, ScheduleInput } from '@/types'
import { defineStore } from 'pinia'

async function failureMessage(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json()
    return Array.isArray(body.message) ? body.message.join(', ') : body.message || fallback
  }
  catch {
    return fallback
  }
}

export const useScheduleStore = defineStore('schedule', () => {
  async function create(screenId: string, input: ScheduleInput): Promise<Schedule> {
    const res = await fetch(`/api/screens/${screenId}/schedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    if (!res.ok)
      throw new Error(await failureMessage(res, 'Failed to create schedule'))
    return await res.json()
  }

  async function update(screenId: string, input: ScheduleInput): Promise<Schedule> {
    const res = await fetch(`/api/screens/${screenId}/schedule`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    if (!res.ok)
      throw new Error(await failureMessage(res, 'Failed to update schedule'))
    return await res.json()
  }

  async function remove(screenId: string): Promise<void> {
    const res = await fetch(`/api/screens/${screenId}/schedule`, { method: 'DELETE' })
    if (!res.ok)
      throw new Error(await failureMessage(res, 'Failed to delete schedule'))
  }

  return { create, update, remove }
})
