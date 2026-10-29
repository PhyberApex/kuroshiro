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

/** A body that never ends, as a host streaming without end sends, and whether its reader cancelled it. */
export function endlessBody(): { body: ReadableStream<Uint8Array>, cancelled: () => boolean } {
  let cancelled = false
  const chunk = new Uint8Array(1024 * 1024).fill(97)
  const body = new ReadableStream<Uint8Array>({
    pull: controller => controller.enqueue(chunk),
    cancel: () => { cancelled = true },
  })
  return { body, cancelled: () => cancelled }
}
