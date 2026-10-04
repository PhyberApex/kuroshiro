import type { CreatePluginInput, DeviceSummary, MergeStrategy, PluginKind } from 'kuroshiro-shared'
import type { Component } from 'vue'
import type { AddPluginWay } from './pluginPaths'
import type { RadioChoice } from '@/components/RadioRow.vue'
import { pluginNameProblem } from './pluginNaming'

/** The Device a Plugin added from its Add Screen is assigned to (`?device=`). */
export interface CarriedDevice {
  id: string
  name: string
}

/**
 * One way of adding a Plugin: a row of the page's radio row and the form shown while it is chosen.
 * The form is handed its `props`, reads the carried Device from `useAddPluginPage()` and ends in an `AddPluginFoot`.
 */
export interface AddPluginWayEntry {
  way: AddPluginWay
  label: string
  hint: string
  form: Component
  props?: Record<string, unknown>
}

/** The way the address names when it is one of `ways`, and the first of them otherwise. */
export function chosenWay(ways: AddPluginWayEntry[], named: unknown): AddPluginWayEntry {
  return ways.find(entry => entry.way === named) ?? ways[0]!
}

/** The Device the address carries. An id of no Device carries nothing. */
export function carriedDevice(devices: DeviceSummary[] | undefined, deviceId: unknown): CarriedDevice | undefined {
  const device = devices?.find(candidate => candidate.id === deviceId)
  return device && { id: device.id, name: device.name }
}

export const MERGE_STRATEGY_CHOICES: RadioChoice<MergeStrategy>[] = [
  { value: 'standard', label: 'Replace', code: 'standard', hint: 'Each POST replaces the Webhook Payload.' },
  { value: 'deep_merge', label: 'Deep merge', code: 'deep_merge', hint: 'Objects are merged key by key. An array is replaced.' },
  { value: 'stream', label: 'Stream', code: 'stream', hint: 'Top-level arrays are appended to, up to the Stream Limit. Other keys are replaced.' },
]

/** What the two ways of building hold between them. A Poll Plugin is built from the name alone. */
export interface BuildDraft {
  name: string
  mergeStrategy: MergeStrategy
  /** `null` while the field holds no number. */
  streamLimit: number | null
}

export const newBuildDraft = (): BuildDraft => ({ name: '', mergeStrategy: 'standard', streamLimit: 20 })

export function buildDraftChanged(draft: BuildDraft) {
  const untouched = newBuildDraft()
  return draft.name.trim() !== untouched.name || draft.mergeStrategy !== untouched.mergeStrategy || draft.streamLimit !== untouched.streamLimit
}

export type BuildProblems = Partial<Record<'name' | 'streamLimit', string>>

const streams = (kind: PluginKind, draft: BuildDraft) => kind === 'Webhook' && draft.mergeStrategy === 'stream'

const isStreamLimit = (value: number | null): value is number => value !== null && Number.isInteger(value) && value >= 1

/** What keeps the Plugin from being created, by field. */
export function buildProblems(kind: PluginKind, draft: BuildDraft): BuildProblems {
  return {
    name: pluginNameProblem(draft.name),
    streamLimit: streams(kind, draft) && !isStreamLimit(draft.streamLimit) ? 'Enter a whole number of 1 or more.' : undefined,
  }
}

export const hasBuildProblems = ({ name, streamLimit }: BuildProblems) => Boolean(name || streamLimit)

/** What is sent for a draft without problems. */
export function buildInput(kind: PluginKind, draft: BuildDraft, deviceId?: string): CreatePluginInput {
  const common = { name: draft.name.trim(), ...(deviceId ? { deviceId } : {}) }
  if (kind === 'Poll')
    return { kind, ...common }
  return {
    kind,
    ...common,
    mergeStrategy: draft.mergeStrategy,
    ...(isStreamLimit(draft.streamLimit) && draft.mergeStrategy === 'stream' ? { streamLimit: draft.streamLimit } : {}),
  }
}
