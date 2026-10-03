import type { ScreenKind, ScreenState } from 'kuroshiro-shared'
import type { ComputedRef, InjectionKey } from 'vue'
import { inject } from 'vue'

/** What a list of rows needs to know of each row to reorder and announce it. */
export interface RowItem {
  id: string
  name: string
}

export type DropEdge = 'before' | 'after'

function insertedAt(ids: string[], index: number, id: string) {
  return [...ids.slice(0, index), id, ...ids.slice(index)]
}

/** The row `id` moved `by` places, staying inside the list. */
export function movedBy(ids: string[], id: string, by: number) {
  const from = ids.indexOf(id)
  const to = Math.min(Math.max(from + by, 0), ids.length - 1)
  return insertedAt(ids.filter(other => other !== id), to, id)
}

/** The row `id` dropped on the `edge` of the row `targetId`. */
export function droppedAt(ids: string[], id: string, targetId: string, edge: DropEdge) {
  if (id === targetId)
    return ids
  const others = ids.filter(other => other !== id)
  return insertedAt(others, others.indexOf(targetId) + (edge === 'after' ? 1 : 0), id)
}

export const sameOrder = (one: string[], other: string[]) => one.length === other.length && one.every((id, index) => id === other[index])

/** What `ScreenRows` hands each `ScreenRow` inside it. */
export interface ScreenRowsContext {
  sortable: ComputedRef<boolean>
  total: ComputedRef<number>
  /** The id of the element that says how the grip is used, for `aria-describedby`. */
  gripHelpId: string
  /** The row's place in the Order, from 1, as shown now: a lifted row counts where it stands. */
  orderOf: (id: string) => number
  liftedBy: (id: string) => 'keyboard' | 'pointer' | undefined
  /** For the gallery: whether the row's grip is drawn as holding the focus. */
  gripForce: (id: string) => 'focus' | undefined
  dropEdgeOf: (id: string) => DropEdge | undefined
  pressGrip: (id: string, event: KeyboardEvent) => void
  leaveGrip: (id: string) => void
  nudge: (id: string, by: -1 | 1) => void
  /** Makes the row draggable by its grip and a place to drop on. Returns what undoes it. */
  attach: (id: string, row: HTMLElement) => () => void
}

export const screenRowsKey: InjectionKey<ScreenRowsContext> = Symbol('ScreenRows')

export function useScreenRows() {
  const rows = inject(screenRowsKey)
  if (!rows)
    throw new Error('A ScreenRow stands inside a ScreenRows: the list opens one row at a time and reorders them.')
  return rows
}

export const SCREEN_KIND_LABELS: Record<ScreenKind, string> = {
  plugin: 'Plugin',
  mashup: 'Mashup',
  external: 'External link',
  file: 'File',
  html: 'HTML',
}

export const SCREEN_STATE_LABELS: Record<ScreenState, string> = {
  active: 'Active Screen',
  upNext: 'Up next',
  scheduleOff: 'Schedule off',
  notToday: 'Not today',
  notThisHour: 'Not at this hour',
  skipping: 'Skipping',
}

const STATES_ROTATION_PASSES_OVER: ReadonlySet<ScreenState> = new Set(['scheduleOff', 'notToday', 'notThisHour', 'skipping'])

export const isPassedOver = (state: ScreenState | null | undefined) => state != null && STATES_ROTATION_PASSES_OVER.has(state)
