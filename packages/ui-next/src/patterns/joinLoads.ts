import type { Load } from './useLoad'
import { computed, reactive } from 'vue'

/**
 * Several loads as the one a `LoadBody` takes, for a view that shows them together: it has
 * data once every one has, each under its own key, waits while any one waits, and any one's
 * failure is its failure. A record that does not exist is the view's to tell, from the load that says so.
 */
export function joinLoads<T extends object>(loads: { [K in keyof T]: Load<T[K]> }): Load<T> {
  const each = Object.values<Load<unknown>>(loads)
  return reactive({
    data: computed(() => each.every(load => load.data !== undefined)
      ? Object.fromEntries(Object.entries<Load<unknown>>(loads).map(([key, load]) => [key, load.data])) as T
      : undefined),
    waiting: computed(() => each.some(load => load.waiting)),
    failure: computed(() => each.find(load => load.failure)?.failure),
    missing: false,
    reload: async () => {
      await Promise.all(each.map(load => load.reload()))
    },
  }) as Load<T>
}
