import type { ComputedRef, InjectionKey } from 'vue'
import type { CarriedDevice } from './addPlugin'
import { inject, provide } from 'vue'

interface AddPluginPage {
  /** The Device the new Plugin is assigned to, when the address carries one. */
  device: ComputedRef<CarriedDevice | undefined>
  /** Where "Cancel" leads: the carried Device, or where the admin came from. */
  cancelTo: ComputedRef<string>
}

const addPluginPageKey: InjectionKey<AddPluginPage> = Symbol('Add a Plugin')

export function provideAddPluginPage(page: AddPluginPage) {
  provide(addPluginPageKey, page)
}

/** What Add a Plugin hands the form of each way. */
export function useAddPluginPage(): AddPluginPage {
  const page = inject(addPluginPageKey)
  if (!page)
    throw new Error('The form of a way of adding a Plugin stands on the Add a Plugin page.')
  return page
}
