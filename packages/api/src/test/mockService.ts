/**
 * The one documented boundary cast for a hand-built service mock: a plain object of
 * `vi.fn()`s is never structurally identical to the real class (private fields, method
 * overloads), so it needs an `unknown` hop to satisfy a constructor parameter typed as
 * the real service. Prefer a dedicated `createMockXService()` in this directory when the
 * same service is faked across multiple spec files; reach for this generic helper for a
 * mock that's local to a single spec.
 */
export function asService<T>(mock: object): T {
  return mock as unknown as T
}

/**
 * Overwrites a private field on a constructed instance with a test double — the same
 * `unknown` hop as {@link asService}, scoped to assignment instead of construction, for
 * specs that swap out a service's internal collaborator after the fact rather than
 * through its constructor.
 */
export function injectPrivate<T extends object, V>(instance: T, key: string, value: V): void {
  (instance as unknown as Record<string, V>)[key] = value
}

/**
 * Invokes a private method on a constructed instance — the same `unknown` hop as
 * {@link asService}, scoped to a single call, for specs asserting on private helper
 * logic (e.g. a cron-expression builder) that isn't worth exposing publicly.
 */
export function callPrivate<R>(instance: object, key: string, ...args: unknown[]): R {
  return (instance as unknown as Record<string, (...args: unknown[]) => R>)[key](...args)
}
