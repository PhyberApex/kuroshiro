import type { InjectionKey, Ref } from 'vue'
import { inject, onBeforeUnmount, provide, reactive, watch } from 'vue'

const REPORT_SCREEN_FORM_CHANGED: InjectionKey<(id: symbol, changed: boolean) => void> = Symbol('reportScreenFormChanged')

/** Lets `AddScreenPage` hold one guard for every kind's form, kept alive, rather than only the one in view. */
export function provideScreenFormsChanged() {
  const changedForms = reactive(new Set<symbol>())
  provide(REPORT_SCREEN_FORM_CHANGED, (id, changed) => {
    if (changed)
      changedForms.add(id)
    else
      changedForms.delete(id)
  })
  return changedForms
}

/** A kind's form reports its `changed` to the page in place of a guard of its own, so switching kinds keeps every one's answer. */
export function useReportScreenFormChanged(changed: Ref<boolean>) {
  const report = inject(REPORT_SCREEN_FORM_CHANGED)
  if (!report)
    return
  const id = Symbol('screen-form')
  watch(changed, value => report(id, value), { immediate: true })
  onBeforeUnmount(() => report(id, false))
}
