import type { PreviewData, PreviewDataInput } from 'kuroshiro-shared'
import { onScopeDispose, ref, shallowRef, watch } from 'vue'

/** How long a Data Source or a Field Value has to stand unchanged before the data is fetched again: a fetch asks the real world. */
const FETCHED_AFTER_MS = 800

/**
 * The data one Plugin page's preview draws against, fetched once and then held. `input` is what a fetch sends, the form
 * as it stands and the Device the preview is for, and nothing until that Device is known. It is fetched when it is
 * first there, at once for another Device, 800 ms after the last change to a Data Source or a Field Value, and on
 * `fetchAgain`. What is held stays while a fetch runs and when one fails.
 */
export function usePreviewData(input: () => PreviewDataInput | undefined, fetch: (input: PreviewDataInput) => Promise<PreviewData>) {
  const held = shallowRef<PreviewData>()
  const fetching = ref(false)
  /** Why the last fetch gave no data, as a sentence, until one works. */
  const failure = ref<string>()

  let latestFetch = 0
  let timer: ReturnType<typeof setTimeout> | undefined

  async function fetchAgain() {
    clearTimeout(timer)
    const sent = input()
    if (!sent)
      return
    const mine = ++latestFetch
    fetching.value = true
    try {
      const data = await fetch(sent)
      if (mine !== latestFetch)
        return
      held.value = data
      failure.value = undefined
    }
    catch (error) {
      if (mine === latestFetch)
        failure.value = error instanceof Error ? error.message : String(error)
    }
    finally {
      if (mine === latestFetch)
        fetching.value = false
    }
  }

  const stop = watch(
    () => {
      const now = input()
      return now && { device: now.deviceId, fetched: JSON.stringify([now.dataSources, now.fieldValues]) }
    },
    (now, before) => {
      if (!now)
        return
      if (!before || now.device !== before.device) {
        void fetchAgain()
      }
      else if (now.fetched !== before.fetched) {
        clearTimeout(timer)
        timer = setTimeout(fetchAgain, FETCHED_AFTER_MS)
      }
    },
    { immediate: true },
  )

  onScopeDispose(() => {
    stop()
    clearTimeout(timer)
  })

  return { held, fetching, failure, fetchAgain }
}
