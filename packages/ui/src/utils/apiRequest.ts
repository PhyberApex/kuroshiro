type Fallback = string | ((res: Response) => string)

export async function apiRequest<T>(input: RequestInfo, init: RequestInit | undefined, fallback: Fallback): Promise<T> {
  const res = await fetch(input, init)
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.message || (typeof fallback === 'function' ? fallback(res) : fallback))
  }
  return res.json()
}
