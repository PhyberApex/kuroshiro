import type { Mock } from 'vitest'
import { vi } from 'vitest'

export function stubFetch(): Mock<typeof fetch> {
  const mock = vi.fn<typeof fetch>()
  vi.stubGlobal('fetch', mock)
  return mock
}

export function jsonResponse(body: unknown, init: { status?: number, ok?: boolean } = {}): Response {
  const status = init.status ?? (init.ok === false ? 500 : 200)
  return new Response(JSON.stringify(body), { status })
}
