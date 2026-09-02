import type { Schedule, ScheduleInput } from '@/types'
import { defineStore } from 'pinia'
import { apiFetch } from '@/utils/apiRequest'

async function send(method: string, screenId: string, fallbackError: string, input?: ScheduleInput): Promise<Response> {
  const res = await apiFetch(`/api/screens/${screenId}/schedule`, input
    ? { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) }
    : { method })
  if (!res.ok)
    throw new Error(await failureMessage(res, fallbackError))
  return res
}

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
    return (await send('POST', screenId, 'Failed to create schedule', input)).json()
  }

  async function update(screenId: string, input: ScheduleInput): Promise<Schedule> {
    return (await send('PATCH', screenId, 'Failed to update schedule', input)).json()
  }

  async function remove(screenId: string): Promise<void> {
    await send('DELETE', screenId, 'Failed to delete schedule')
  }

  return { create, update, remove }
})
