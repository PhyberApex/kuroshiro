import { onScopeDispose, reactive, ref, shallowRef, watch } from 'vue'
import { isRefusal, isUnreachable } from '@/api/client'
import { failureReason } from '@/components/failureReason'
import { usePolling } from './usePolling'

const WAIT_BEFORE_LOADING_STATE_MS = 300
const RETRY_UNREACHABLE_SERVER_MS = 10_000

const TYPED_IN_CONTROLS = 'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="combobox"], [role="textbox"], [role="spinbutton"]'

export interface LoadFailure {
  /** The sentence the admin reads: the server's reason, or that it is not answering. */
  reason: string
  /** The server could not be reached at all, so the load retries by itself. */
  unreachable: boolean
}

export interface Load<T> {
  /** What the last load that worked answered. It stays through a later failure. */
  readonly data: T | undefined
  /** There is nothing to show yet and the answer has taken more than 300 ms: show the body's skeleton and the loading line. */
  readonly waiting: boolean
  readonly failure: LoadFailure | undefined
  /** The server answered 404: the record does not exist. */
  readonly missing: boolean
  /** "Try again". */
  reload: () => Promise<void>
}

export interface LoadOptions {
  /** Keeps the data fresh: asks again every 30 seconds while the tab is visible and when it regains the focus. */
  fresh?: boolean
  /** What the load depends on, such as a route parameter. When it changes the data is dropped and loaded anew. */
  key?: () => unknown
}

const isTypedInControl = (element: EventTarget | null) => element instanceof Element && element.matches(TYPED_IN_CONTROLS)

const sameAnswer = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/**
 * Loads what a view shows and holds the states of the shared patterns "Loading", "A failed
 * load" and "Fresh data". `fetcher` is a function of `src/api/`; what it rejects with decides
 * the failure's wording.
 */
export function useLoad<T>(fetcher: () => Promise<T>, { fresh = false, key }: LoadOptions = {}): Load<T> {
  const data = shallowRef<T>()
  const waiting = ref(false)
  const failure = ref<LoadFailure>()
  const missing = ref(false)

  let latestRequest = 0
  let asking = false
  let waitTimer: ReturnType<typeof setTimeout> | undefined
  let retryTimer: ReturnType<typeof setTimeout> | undefined
  let heldBack: { answer: T } | undefined

  function showAnswer(answer: T) {
    heldBack = undefined
    failure.value = undefined
    missing.value = false
    if (!sameAnswer(answer, data.value))
      data.value = answer
  }

  function releaseHeldAnswer({ relatedTarget }: FocusEvent) {
    if (isTypedInControl(relatedTarget))
      return
    document.removeEventListener('focusout', releaseHeldAnswer)
    if (heldBack)
      showAnswer(heldBack.answer)
  }

  function holdBack(answer: T) {
    heldBack = { answer }
    document.addEventListener('focusout', releaseHeldAnswer)
  }

  function showFailure(error: unknown) {
    const unreachable = isUnreachable(error)
    failure.value = { reason: failureReason(error) ?? 'Something went wrong.', unreachable }
    missing.value = isRefusal(error) && error.statusCode === 404
    if (unreachable)
      retryTimer = setTimeout(ask, RETRY_UNREACHABLE_SERVER_MS, { quietly: true })
  }

  function startWaiting() {
    clearTimeout(waitTimer)
    if (data.value === undefined) {
      waitTimer = setTimeout(() => {
        waiting.value = true
      }, WAIT_BEFORE_LOADING_STATE_MS)
    }
  }

  function stopWaiting() {
    clearTimeout(waitTimer)
    waiting.value = false
  }

  async function ask({ quietly }: { quietly: boolean }) {
    const request = ++latestRequest
    asking = true
    clearTimeout(retryTimer)
    if (!quietly)
      startWaiting()
    const outcome = await fetcher().then(answer => ({ answer }), (error: unknown) => ({ error }))
    if (request !== latestRequest)
      return
    asking = false
    stopWaiting()
    if ('error' in outcome)
      showFailure(outcome.error)
    else if (quietly && isTypedInControl(document.activeElement))
      holdBack(outcome.answer)
    else
      showAnswer(outcome.answer)
  }

  function refresh() {
    if (!asking)
      void ask({ quietly: true })
  }

  function startOver() {
    data.value = undefined
    failure.value = undefined
    missing.value = false
    heldBack = undefined
    void ask({ quietly: false })
  }

  if (key)
    watch(key, startOver)
  if (fresh)
    usePolling(refresh)

  onScopeDispose(() => {
    latestRequest = Number.NaN
    clearTimeout(waitTimer)
    clearTimeout(retryTimer)
    document.removeEventListener('focusout', releaseHeldAnswer)
  })

  void ask({ quietly: false })

  return reactive({ data, waiting, failure, missing, reload: () => ask({ quietly: false }) }) as Load<T>
}
