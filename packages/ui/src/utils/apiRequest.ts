import { withBasePath } from './basePath'

type Fallback = string | ((res: Response) => string)

/** `fetch`, but resolved against the runtime base path so it keeps working under a reverse-proxy prefix. */
export async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  return fetch(withBasePath(input), init)
}

export async function apiRequest<T>(input: string, init: RequestInit | undefined, fallback: Fallback): Promise<T> {
  const res = await apiFetch(input, init)
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.message || (typeof fallback === 'function' ? fallback(res) : fallback))
  }
  return res.json()
}
