/**
 * The one documented boundary cast for a hand-built Pinia store mock: a plain object of
 * `vi.fn()`s is never structurally identical to the real store (getters, `$patch`, etc.),
 * so it needs an `unknown` hop to satisfy a prop or composable typed as the real store.
 */
export function asStore<T>(mock: object): T {
  return mock as unknown as T
}
