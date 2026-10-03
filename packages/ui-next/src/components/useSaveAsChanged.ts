import type { Ref } from 'vue'
import { getCurrentScope, onScopeDispose, reactive, ref } from 'vue'
import { failureReason } from './failureReason'

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'failed'

const SAVED_SHOWN_MS = 2000

/**
 * The state machine of save as changed, for `SaveState` and `SettingRow` to show.
 *
 * `commit` saves what `value` holds (a control's `commit` or `update:modelValue` calls it),
 * `retry` repeats the last save. A save that worked puts the server's answer into `value`,
 * unless the admin has changed it since; a save that failed leaves `value` as entered.
 */
export function useSaveAsChanged<T>(save: (value: T) => Promise<T | void>, value: Ref<T>) {
  const status = ref<SaveStatus>('idle')
  const reason = ref<string>()
  let attempts = 0
  let entered = value.value
  let savedTimer: ReturnType<typeof setTimeout> | undefined

  function run() {
    const attempt = ++attempts
    const sent = entered
    const isNewest = () => attempt === attempts
    clearTimeout(savedTimer)
    status.value = 'saving'
    reason.value = undefined

    save(sent).then(
      (answer) => {
        if (!isNewest())
          return
        if (answer !== undefined && value.value === sent)
          value.value = answer
        status.value = 'saved'
        savedTimer = setTimeout(() => {
          status.value = 'idle'
        }, SAVED_SHOWN_MS)
      },
      (error: unknown) => {
        if (!isNewest())
          return
        status.value = 'failed'
        reason.value = failureReason(error)
      },
    )
  }

  if (getCurrentScope())
    onScopeDispose(() => clearTimeout(savedTimer))

  return reactive({
    status,
    reason,
    commit() {
      entered = value.value
      run()
    },
    retry: run,
  })
}
