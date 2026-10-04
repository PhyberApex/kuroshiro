import { reactive, ref, shallowRef } from 'vue'
import { isRefusal } from '@/api/client'
import { failureReason } from '@/components/failureReason'

/** TRMNL's own reason when the server passes one on, otherwise how the request failed. */
function whyNotSynced(error: unknown) {
  const reason = isRefusal(error, 'upstream-unreachable') ? error.details.reason : undefined
  return typeof reason === 'string' && reason ? reason : failureReason(error)
}

/**
 * A sync with TRMNL an admin starts from a page: `sync()` runs it, and what came of it stays
 * until the page is left. `synced` is called with the answer of a sync that worked, to read
 * again what the sync changed.
 */
export function useTrmnlSync<Result>(run: () => Promise<Result>, synced: (result: Result) => unknown = () => {}) {
  const running = ref(false)
  const result = shallowRef<Result>()
  const failed = ref(false)
  const reason = ref<string>()

  async function sync() {
    if (running.value)
      return
    running.value = true
    failed.value = false
    result.value = undefined
    try {
      const answer = await run()
      await synced(answer)
      result.value = answer
    }
    catch (error) {
      failed.value = true
      reason.value = whyNotSynced(error)
    }
    finally {
      running.value = false
    }
  }

  return reactive({ running, result, failed, reason, sync })
}
