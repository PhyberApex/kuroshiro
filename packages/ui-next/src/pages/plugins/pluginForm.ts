import type { PluginDetail, UpdatePluginInput } from 'kuroshiro-shared'
import type { Ref } from 'vue'
import { computed, reactive, ref, shallowReactive, shallowRef } from 'vue'
import { fieldErrorsOf } from '@/api/client'
import { failureReason } from '@/components/failureReason'
import { listed } from './pluginWording'

export type PluginInputKey = keyof UpdatePluginInput

/** One thing to fix, at the path the server names the field by: `name`, `dataSources.2.url`. */
export interface FieldProblem {
  path: string
  message: string
}

/**
 * The part of the Plugin page's one form that one section edits. `Draft` is what the section's
 * controls are bound to; it is plain data (it is compared and copied as JSON).
 */
export interface PluginFormPart<Draft> {
  /** The keys of `UpdatePluginInput` this part saves. No two parts save the same key. */
  keys: readonly PluginInputKey[]
  /** The draft of a Plugin as it is saved. The same Plugin always reads as the same draft. */
  read: (plugin: PluginDetail) => Draft
  /** What a save sends for `keys`: each key whole, input-shaped. A key it leaves out is never sent. */
  toInput: (draft: Draft) => UpdatePluginInput
  /** What stops a save, with the paths `toInput` would send the fields at. */
  validate?: (draft: Draft, context: { plugin: PluginDetail, unsaved: UpdatePluginInput }) => FieldProblem[]
}

/** Opens whatever holds the field at `path` (a row, a tucked section), so that it can be focused. */
export type RevealField = (path: string) => unknown

interface PluginFormPartHandle<Draft> {
  /** What the section's controls edit. */
  draft: Draft
  /** The draft as it is saved. */
  readonly saved: Draft
  /** This part's problems by path, for each `Field`'s `error`: its own once a save was tried, and the server's. */
  readonly errors: Record<string, string>
  /** Takes the part out of the form, with its changes. */
  remove: () => void
}

interface Registered {
  part: PluginFormPart<unknown>
  reveal?: RevealField
  /** The Plugin the saved draft was read from. */
  source: Ref<PluginDetail>
  draft: Ref<unknown>
}

interface Refusal {
  reason: string | undefined
  fields: Record<string, string>
  /** What each part would have sent when the save was refused: an edit to a part drops what the server said about it. */
  refused: Map<Registered, string>
}

/** The keys in the order their sections stand on the page, which is the order they are named in. */
const KEYS_IN_PAGE_ORDER: readonly PluginInputKey[] = ['templates', 'refreshInterval', 'dataSources', 'fieldValues', 'fields', 'name', 'description']

const KEY_NAMES: Record<PluginInputKey, string> = {
  templates: 'template',
  refreshInterval: 'refresh interval',
  dataSources: 'Data Sources',
  fieldValues: 'Field Values',
  fields: 'Plugin Fields',
  name: 'name',
  description: 'description',
}

/** What the Template section's preview draws from, so what it shows before a save. */
const PREVIEWED: readonly PluginInputKey[] = ['templates', 'dataSources', 'fieldValues', 'fields', 'refreshInterval', 'name']

const named = (keys: readonly PluginInputKey[]) => listed(keys.map(key => KEY_NAMES[key]))

/** The save bar's sentence after "Unsaved changes": "to the template and Data Sources. The preview already shows them." */
export function changedSentence(keys: readonly PluginInputKey[], { previewed }: { previewed: boolean }) {
  const shownInPreview = previewed && keys.some(key => PREVIEWED.includes(key))
  return `to the ${named(keys)}.${shownInPreview ? ' The preview already shows them.' : ''}`
}

/** What "Leave without saving?" says is lost. */
export function lostSentence(pluginName: string, keys: readonly PluginInputKey[]) {
  return `Your changes to ${pluginName}'s ${named(keys)}.`
}

export function thingsToFix(count: number) {
  return `${count} ${count === 1 ? 'thing' : 'things'} to fix before this can be saved.`
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

const ownerKeyOf = (path: string) => path.split('.')[0]!

/**
 * The Plugin page's one form: every section registers the part of the Plugin it edits, and the
 * form holds what is saved, what is entered, what differs and what is wrong, and saves the
 * difference in one request.
 */
export function createPluginForm(loaded: PluginDetail, send: (input: UpdatePluginInput) => Promise<PluginDetail>) {
  const plugin = shallowRef(loaded)
  const parts = shallowReactive<Registered[]>([])
  const saving = ref(false)
  const attempted = ref(false)
  const refusal = shallowRef<Refusal>()

  const inputOf = ({ part, draft }: Registered) => part.toInput(draft.value)
  const savedInputOf = ({ part, source }: Registered) => part.toInput(part.read(source.value))

  function changesOf(registered: Registered): UpdatePluginInput {
    const saved = savedInputOf(registered)
    return Object.fromEntries(Object.entries(inputOf(registered))
      .filter(([key, value]) => value !== undefined && !same(value, saved[key as PluginInputKey])))
  }

  const unsaved = computed<UpdatePluginInput>(() => Object.assign({}, ...parts.map(inputOf)))
  const changes = computed<UpdatePluginInput>(() => Object.assign({}, ...parts.map(changesOf)))
  const changedKeys = computed(() => KEYS_IN_PAGE_ORDER.filter(key => key in changes.value))
  const changed = computed(() => changedKeys.value.length > 0)

  const ownProblems = computed(() => parts.flatMap(({ part, draft }) =>
    part.validate?.(draft.value, { plugin: plugin.value, unsaved: unsaved.value }) ?? []))

  const ownerOf = (path: string) => parts.find(({ part }) => (part.keys as readonly string[]).includes(ownerKeyOf(path)))

  /** The server's field errors that still stand: those of a part that has not been edited since. */
  const refusedProblems = computed<FieldProblem[]>(() => {
    const refused = refusal.value
    if (!refused)
      return []
    return parts.flatMap(registered => refused.refused.get(registered) !== JSON.stringify(inputOf(registered))
      ? []
      : Object.entries(refused.fields)
          .filter(([path]) => ownerOf(path) === registered)
          .map(([path, message]) => ({ path, message })))
  })

  const problems = computed(() => attempted.value && ownProblems.value.length > 0 ? ownProblems.value : refusedProblems.value)

  /** Why the last save did not happen, until the form is edited or saved again. A refusal the fields explain is told by them. */
  const failure = computed(() => {
    const refused = refusal.value
    const edited = refused && parts.some(registered => refused.refused.get(registered) !== JSON.stringify(inputOf(registered)))
    return !refused || edited || problems.value.length > 0 ? undefined : refused.reason ?? 'That did not work.'
  })

  function errorsOf(registered: Registered) {
    return Object.fromEntries(problems.value
      .filter(({ path }) => ownerOf(path) === registered)
      .map(({ path, message }) => [path, message]))
  }

  function register<Draft>(part: PluginFormPart<Draft>, reveal?: RevealField): PluginFormPartHandle<Draft> {
    const taken = part.keys.find(key => parts.some(other => other.part.keys.includes(key)))
    if (taken)
      throw new Error(`Another part of the Plugin's form already saves "${taken}".`)
    const registered: Registered = {
      part: part as PluginFormPart<unknown>,
      reveal,
      source: shallowRef(plugin.value),
      draft: ref(part.read(plugin.value)),
    }
    parts.push(registered)
    return reactive({
      draft: registered.draft,
      saved: computed(() => part.read(registered.source.value)),
      errors: computed(() => errorsOf(registered)),
      remove: () => void parts.splice(parts.indexOf(registered), 1),
    }) as PluginFormPartHandle<Draft>
  }

  function follow(registered: Registered, from: PluginDetail) {
    registered.source.value = from
    const read = registered.part.read(from)
    if (!same(read, registered.draft.value))
      registered.draft.value = read
  }

  const isChanged = (registered: Registered) => Object.keys(changesOf(registered)).length > 0

  /** Takes a re-read of the Plugin: a part without unsaved changes follows it, a part with them is left alone. */
  function refresh(fresh: PluginDetail) {
    plugin.value = fresh
    parts.filter(registered => !isChanged(registered)).forEach(registered => follow(registered, fresh))
  }

  function discard() {
    attempted.value = false
    refusal.value = undefined
    parts.forEach(registered => follow(registered, registered.source.value))
  }

  function accept(answer: PluginDetail, sent: Map<Registered, string>) {
    plugin.value = answer
    parts.forEach((registered) => {
      if (sent.get(registered) === JSON.stringify(registered.draft.value))
        follow(registered, answer)
      else
        registered.source.value = answer
    })
  }

  /** Saves what differs, in one request. Answers the Plugin as saved, or nothing when nothing was sent or the save did not happen. */
  async function save(): Promise<PluginDetail | undefined> {
    attempted.value = true
    if (saving.value || !changed.value || ownProblems.value.length > 0)
      return undefined
    saving.value = true
    const sent = new Map(parts.map(registered => [registered, JSON.stringify(registered.draft.value)]))
    const refused = new Map(parts.map(registered => [registered, JSON.stringify(inputOf(registered))]))
    try {
      const answer = await send(changes.value)
      attempted.value = false
      refusal.value = undefined
      accept(answer, sent)
      return answer
    }
    catch (error) {
      refusal.value = { reason: failureReason(error), fields: fieldErrorsOf(error), refused }
      return undefined
    }
    finally {
      saving.value = false
    }
  }

  /** "Show the first": has the part that owns the first problem open what holds its field, and answers the field's path. */
  async function showFirst(): Promise<string | undefined> {
    const first = problems.value[0]
    if (!first)
      return undefined
    await ownerOf(first.path)?.reveal?.(first.path)
    return first.path
  }

  return reactive({
    /** The Plugin as the form last heard of it: loaded, re-read or answered by a save. */
    plugin,
    /** Everything every part would send, changed or not: the unsaved state the preview draws. */
    unsaved,
    /** What a save sends: only the keys that differ from what is saved. */
    changes,
    changedKeys,
    changed,
    /** Whether the Template section has joined the form, so whether the page has a preview. */
    previewed: computed(() => ownerOf('templates') !== undefined),
    problems,
    failure,
    saving,
    register,
    refresh,
    discard,
    save,
    showFirst,
  })
}

export type PluginForm = ReturnType<typeof createPluginForm>
