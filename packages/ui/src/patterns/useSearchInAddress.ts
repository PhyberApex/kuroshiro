import type { Ref } from 'vue'
import { onScopeDispose, ref, watch } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'

const SEARCH_WAITS_MS = 300

/**
 * A search field whose search is kept in the address. `typed` is what the field holds; what is searched for is
 * `sought()`, which `hold(search)` writes into the address 300 ms after typing stops, once `searchable(typed)`
 * answers something else than it. `clear()` empties the field at once, for a "Show all" that also clears the address.
 */
export function useSearchInAddress({ sought, searchable, hold }: {
  sought: () => string
  /** What a field's text searches for; empty for no search. */
  searchable: (typed: string) => string
  hold: (search: string | undefined) => void
}): { typed: Ref<string>, clear: () => void } {
  const typed = ref(sought())
  let searchTimer: ReturnType<typeof setTimeout> | undefined
  watch(typed, (now) => {
    clearTimeout(searchTimer)
    if (searchable(now) !== sought())
      searchTimer = setTimeout(() => hold(searchable(now) || undefined), SEARCH_WAITS_MS)
  })
  // Left inside the wait, the search would land in the address of whatever page came next,
  // or, while that page still loads, call the leaving off. A key pressed while it loads starts
  // a wait after the guard ran, so the page drops it again on its way out.
  onBeforeRouteLeave(() => clearTimeout(searchTimer))
  onScopeDispose(() => clearTimeout(searchTimer))
  // The address changed under the field: "Show all", or the browser's back button.
  watch(sought, (now) => {
    if (searchable(typed.value) !== now)
      typed.value = now
  })

  function clear() {
    clearTimeout(searchTimer)
    typed.value = ''
  }

  return { typed, clear }
}
