import type { Ref } from 'vue'
import { onScopeDispose, ref } from 'vue'

const TICK_MS = 30_000

const now = ref(new Date())
let readers = 0
let timer: ReturnType<typeof setInterval> | undefined

/** The current time, moving on every 30 seconds, so every relative time on a page changes in the same moment. */
export function useNow(): Readonly<Ref<Date>> {
  now.value = new Date()
  if (readers++ === 0) {
    timer = setInterval(() => {
      now.value = new Date()
    }, TICK_MS)
  }
  onScopeDispose(() => {
    if (--readers === 0)
      clearInterval(timer)
  })
  return now
}
