/** TRMNL's `find_by`: the first object whose `key` is `value`, or the fallback when none is. */
export function findBy(list: unknown, key: unknown, value: unknown, fallback?: unknown): unknown {
  if (!Array.isArray(list))
    return fallback
  const found = list.find(item => item !== null && typeof item === 'object' && (item as Record<string, unknown>)[String(key)] === value)
  return found ?? fallback
}
