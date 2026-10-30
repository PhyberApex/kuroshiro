import type { InjectionKey, Ref } from 'vue'
import { inject, onBeforeUnmount, provide, reactive, watch } from 'vue'

interface ScreenFormsChanged {
  report: (id: symbol, changed: boolean) => void
  /** Empties what was reported, so the page's guard does not ask about a Screen already added. */
  settle: () => void
}

const screenFormsChangedKey: InjectionKey<ScreenFormsChanged> = Symbol('screenFormsChanged')

/** Lets `AddScreenPage` hold one guard for every kind's form, kept alive, rather than only the one in view. */
export function provideScreenFormsChanged() {
  const changedForms = reactive(new Set<symbol>())
  provide(screenFormsChangedKey, {
    report(id, changed) {
      if (changed)
        changedForms.add(id)
      else
        changedForms.delete(id)
    },
    settle: () => changedForms.clear(),
  })
  return changedForms
}

/** A kind's form reports its `changed` to the page in place of a guard of its own, so switching kinds keeps every one's answer. */
export function useReportScreenFormChanged(changed: Ref<boolean>) {
  // Outside Add Screen nothing provides it, so no warning is wanted.
  const forms = inject(screenFormsChangedKey, undefined)
  if (!forms)
    return
  const id = Symbol('screen-form')
  watch(changed, value => forms.report(id, value), { immediate: true })
  onBeforeUnmount(() => forms.report(id, false))
}

/**
 * Once a Screen is added the page is left for it, and no kind's form holds anything to lose any more,
 * including another kind's kept alive with something entered. Outside Add Screen this does nothing.
 */
export function useSettleScreenForms() {
  const forms = inject(screenFormsChangedKey, undefined)
  return () => forms?.settle()
}
