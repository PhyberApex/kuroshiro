import { onScopeDispose } from 'vue'

const FRESH_DATA_INTERVAL_MS = 30_000

const tabIsVisible = () => document.visibilityState === 'visible'

/**
 * Runs `ask` every `everyMs` while the tab is visible, and at once when the tab shows again
 * or the window regains the focus. Stops with the scope it was started in. Left out, `everyMs`
 * is the 30 seconds of "Fresh data"; a view that waits for something to happen passes less.
 */
export function usePolling(ask: () => void, everyMs = FRESH_DATA_INTERVAL_MS) {
  const askWhileVisible = () => {
    if (tabIsVisible())
      ask()
  }
  const timer = setInterval(askWhileVisible, everyMs)
  window.addEventListener('focus', askWhileVisible)
  document.addEventListener('visibilitychange', askWhileVisible)

  onScopeDispose(() => {
    clearInterval(timer)
    window.removeEventListener('focus', askWhileVisible)
    document.removeEventListener('visibilitychange', askWhileVisible)
  })
}
