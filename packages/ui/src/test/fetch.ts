import type { Mock } from 'vitest'
import { vi } from 'vitest'

export function stubFetch(): Mock<typeof fetch> {
  const mock = vi.fn<typeof fetch>()
  vi.stubGlobal('fetch', mock)
  return mock
}

export function jsonResponse(body: unknown, init: boolean | { ok?: boolean, status?: number, statusText?: string } = true): Response {
  const { ok = true, status, statusText } = typeof init === 'boolean' ? { ok: init } : init
  return new Response(JSON.stringify(body), { status: status ?? (ok ? 200 : 500), statusText })
}
