import type { Ref } from 'vue'
import { computed, inject, onScopeDispose, ref } from 'vue'
import { routeLocationKey } from 'vue-router'

const withoutHash = (hash: string) => hash.replace(/^#/, '')

/**
 * The fragment of the current address, without its `#`. It follows the router where there
 * is one, because a routed navigation fires no `hashchange`, and the window where there is none.
 */
export function useUrlFragment(): Readonly<Ref<string>> {
  const route = inject(routeLocationKey, null)
  if (route)
    return computed(() => withoutHash(route.hash))

  const fragment = ref(withoutHash(window.location.hash))
  const follow = () => {
    fragment.value = withoutHash(window.location.hash)
  }
  window.addEventListener('hashchange', follow)
  onScopeDispose(() => window.removeEventListener('hashchange', follow))
  return fragment
}
