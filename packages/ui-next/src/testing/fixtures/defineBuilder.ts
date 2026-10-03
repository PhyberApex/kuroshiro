/**
 * Turns the default value of a read model into its fixture builder. `T` is always a type
 * of `kuroshiro-shared`, so a key added to the read model fails type-check here until the
 * defaults decide it.
 */
export function defineBuilder<T extends object>(defaults: () => T) {
  return (overrides: Partial<T> = {}): T => ({ ...defaults(), ...overrides })
}
