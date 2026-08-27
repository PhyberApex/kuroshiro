export async function apiRequest<T>(
  input: RequestInfo,
  init: RequestInit | undefined,
  fallback: string | ((res: Response) => string),
): Promise<T> {
  const res = await fetch(input, init)
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.message ?? (typeof fallback === 'function' ? fallback(res) : fallback))
  }
  return res.json()
}
