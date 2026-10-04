import { onScopeDispose } from 'vue'

const FRESH_DATA_INTERVAL_MS = 30_000

const tabIsVisible = () => document.visibilityState === 'visible'

/**
 * The "Fresh data" rhythm: runs `ask` every 30 seconds while the tab is visible, and at
 * once when the tab shows again or the window regains the focus. Stops with the scope it
 * was started in. A view that waits for something to happen passes a shorter `everyMs`.
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
