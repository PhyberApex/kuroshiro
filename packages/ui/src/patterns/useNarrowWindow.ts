import { onScopeDispose, ref } from 'vue'

/** Whether the window is below 820 px, where the phone layout starts. For what CSS cannot do: moving a part to another place in the page's order. */
export function useNarrowWindow() {
  const query = window.matchMedia('(max-width: 820px)')
  const narrow = ref(query.matches)
  const follow = () => {
    narrow.value = query.matches
  }
  query.addEventListener('change', follow)
  onScopeDispose(() => query.removeEventListener('change', follow))
  return narrow
}
