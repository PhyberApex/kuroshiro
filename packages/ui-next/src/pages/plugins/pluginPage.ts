import type { PluginDetail } from 'kuroshiro-shared'
import type { ComputedRef, InjectionKey } from 'vue'
import type { PluginForm, PluginFormPart, RevealField } from './pluginForm'
import { inject, onScopeDispose, provide } from 'vue'

/** What the Plugin page hands every section on it. */
export interface PluginPage {
  /** The Plugin as the server last answered it, re-read every 30 seconds: the facts a section shows that the form does not hold. */
  plugin: ComputedRef<PluginDetail>
  /** The page's one form. A section joins it with `usePluginFormPart`, and reads `form.unsaved` for the state that is not saved yet. */
  form: PluginForm
  /** Reads the Plugin again: call it after a write that acts at once (assigning, clearing the Webhook Payload). */
  reload: () => Promise<void>
  /** Asks "Leave without saving?" while the form holds unsaved changes, and runs `action` unless the admin keeps editing. A route change is asked about by itself. */
  leaveFor: (action: () => unknown) => Promise<void>
}

const pluginPageKey: InjectionKey<PluginPage> = Symbol('Plugin page')

export function providePluginPage(page: PluginPage) {
  provide(pluginPageKey, page)
}

export function usePluginPage() {
  const page = inject(pluginPageKey)
  if (!page)
    throw new Error('A section of the Plugin page stands under the Plugin page.')
  return page
}

/**
 * Joins the page's one form with the part a section edits, for as long as the section is
 * mounted. `reveal` opens whatever holds the field at a path (a row, a tucked section), after
 * which the page focuses the control whose id is `fieldId(path)`.
 */
export function usePluginFormPart<Draft>(part: PluginFormPart<Draft>, reveal?: RevealField) {
  const handle = usePluginPage().form.register(part, reveal)
  onScopeDispose(handle.remove)
  return handle
}

/** The id of the control that edits the field at `path`, which "Show the first" focuses: `dataSources.2.url` is `plugin-dataSources-2-url`. */
export const fieldId = (path: string) => `plugin-${path.replaceAll('.', '-')}`
