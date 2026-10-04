/** One thing completion offers: a name or a key, with the kind of its value. */
export interface NameCompletion {
  label: string
  detail?: string
}

const LIST_KEYS = ['first', 'last', 'size'] as const

/** The kind of a value as completion words it: "object", "list of 8", "string". */
export function kindOf(value: unknown): string {
  if (Array.isArray(value))
    return `list of ${value.length}`
  return value === null ? 'null' : typeof value
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null

function stepInto(value: unknown, key: string): unknown {
  if (Array.isArray(value))
    return { first: value[0], last: value.at(-1) }[key]
  return isObject(value) ? value[key] : undefined
}

function withKinds(value: Record<string, unknown>): NameCompletion[] {
  return Object.entries(value).map(([label, held]) => ({ label, detail: kindOf(held) }))
}

/** Every name the data holds, with its kind. */
export const namesOf = (data: Record<string, unknown>) => withKinds(data)

/** The keys under a dotted path in the data; for a list, what Liquid reads from one. */
export function keysUnder(data: Record<string, unknown>, path: readonly string[]): NameCompletion[] {
  const value = path.reduce<unknown>(stepInto, data)
  if (Array.isArray(value))
    return LIST_KEYS.map(label => ({ label }))
  return isObject(value) ? withKinds(value) : []
}
