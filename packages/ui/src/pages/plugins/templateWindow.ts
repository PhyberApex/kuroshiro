import type { Ref } from 'vue'
import { computed, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useNarrowWindow } from '@/patterns/useNarrowWindow'

/** What `?view=` holds while the Template section takes the full window. */
const TEMPLATE_VIEW = 'template'

/** Where the page's save bar stands while the Template section takes the full window: an element the section renders at its foot. */
export const TEMPLATE_WINDOW_FOOT = 'template-window-foot'

/**
 * The full window of the Template section: a state of the Plugin's route, `?view=template`, so that Back returns to
 * the page and the address can be shared. It is not offered below 820 px, where the address shows the page.
 */
export function useTemplateWindow() {
  const route = useRoute()
  const router = useRouter()
  const narrow = useNarrowWindow()

  const offered = computed(() => !narrow.value)
  const open = computed(() => offered.value && route.query.view === TEMPLATE_VIEW)

  function enter() {
    return router.push({ path: route.path, query: { ...route.query, view: TEMPLATE_VIEW } })
  }

  /**
   * Shows the page again, and resolves once it is shown. It goes back in the history when the page is what stands
   * there, so that "Back to the page" and the browser's Back are one step.
   */
  function leave() {
    const { view: _view, ...query } = route.query
    const page = router.resolve({ path: route.path, query })
    if (window.history.state?.back !== page.fullPath)
      return router.replace(page).then(() => {})
    return new Promise<void>((resolve) => {
      const arrived = router.afterEach(() => {
        arrived()
        resolve()
      })
      router.back()
    })
  }

  return { offered, open, enter, leave }
}

/**
 * While `open`, the window does not scroll and everything beside `section` in its parent is inert: the section covers
 * the rest of the page, which must not take the focus or be read from behind it.
 */
export function useWindowTaken(section: () => HTMLElement | null | undefined, open: Ref<boolean>) {
  watchEffect((onCleanup) => {
    const taking = section()
    if (!open.value || !taking?.parentElement)
      return
    const behind = [...taking.parentElement.children].filter((sibling): sibling is HTMLElement => sibling instanceof HTMLElement && sibling !== taking && !sibling.inert)
    const root = document.documentElement
    const scrolled = root.style.overflow
    behind.forEach(sibling => (sibling.inert = true))
    root.style.overflow = 'hidden'
    onCleanup(() => {
      behind.forEach(sibling => (sibling.inert = false))
      root.style.overflow = scrolled
    })
  }, { flush: 'post' })
}
