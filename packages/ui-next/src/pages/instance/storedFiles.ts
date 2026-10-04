import type { CleanupResult, StorageCheck, StorageFinding } from 'kuroshiro-shared'
import { onScopeDispose, reactive, shallowRef } from 'vue'
import { checkStoredFiles, cleanUpStoredFiles } from '@/api/maintenance'
import { failureReason } from '@/components/failureReason'

type StoredFilesState
  = | { step: 'checking' }
    | { step: 'checked', check: StorageCheck }
    | { step: 'failed', reason: string }

interface Cleaned {
  result: CleanupResult
  /** What the check that was cleaned up listed, to name what could not be removed. */
  findings: StorageFinding[]
}

/**
 * The stored-files check and its clean-up. The check runs at once and again on `check()`;
 * `cleanUp(ids)` removes those findings, keeps what the server answered until the next
 * `check()` and checks again, so what could not be removed is listed anew.
 */
export function useStoredFiles() {
  const state = shallowRef<StoredFilesState>({ step: 'checking' })
  const cleaned = shallowRef<Cleaned>()
  let latest = 0
  let gone = false

  async function runCheck() {
    const request = ++latest
    state.value = { step: 'checking' }
    const next: StoredFilesState = await checkStoredFiles().then(
      check => ({ step: 'checked', check }),
      (error: unknown) => ({ step: 'failed', reason: failureReason(error) ?? 'Something went wrong.' }),
    )
    if (request === latest && !gone)
      state.value = next
  }

  function check() {
    cleaned.value = undefined
    return runCheck()
  }

  async function cleanUp(findingIds: string[], findings: StorageFinding[]) {
    const result = await cleanUpStoredFiles({ findingIds })
    cleaned.value = { result, findings }
    void runCheck()
  }

  onScopeDispose(() => {
    gone = true
  })

  void runCheck()

  return reactive({ state, cleaned, check, cleanUp })
}

export type StoredFiles = ReturnType<typeof useStoredFiles>
