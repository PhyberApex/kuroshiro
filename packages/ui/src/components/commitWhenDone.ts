import type { Ref } from 'vue'

/**
 * The "commit" of a typed-in control: `hold` on focus, `commit` on blur and on Enter. It
 * reports a value once, and only when it differs from the one the control held on focus
 * or committed last, so Enter followed by blur saves once and tabbing through saves nothing.
 */
export function commitWhenDone<T>(model: Ref<T>, report: (value: T) => void) {
  let committed = model.value
  return {
    hold() {
      committed = model.value
    },
    commit() {
      if (model.value === committed)
        return
      committed = model.value
      report(model.value)
    },
  }
}
