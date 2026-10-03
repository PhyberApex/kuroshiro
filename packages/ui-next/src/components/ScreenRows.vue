<script setup lang="ts" generic="T extends RowItem">
import type { DropEdge, LiftedBy, RowItem, Step } from './screenRows'
import { autoScrollWindowForElements } from '@atlaskit/pragmatic-drag-and-drop-auto-scroll/element'
import { combine } from '@atlaskit/pragmatic-drag-and-drop/combine'
import { draggable, dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
import { AccordionRoot } from 'reka-ui'
import { computed, nextTick, provide, ref, useId, watch, watchEffect } from 'vue'
import { droppedAt, movedBy, sameOrder, screenRowsKey } from './screenRows'

const props = defineProps<{
  /** The rows in the order they stand in. The list is controlled: it emits `reorder` and shows the new order once `items` holds it. */
  items: T[]
  /** Gives each row its grip, its two move buttons on phone and its Order. */
  sortable?: boolean
  /** Holds the drag state still, for the gallery: the id of the lifted row, what lifted it, and the id of the row the landing line is drawn before or after. */
  force?: { lifted?: string, by?: LiftedBy, dropBefore?: string, dropAfter?: string }
}>()

const emit = defineEmits<{
  /** Every row's id, once, in the order the admin put them in. A failed save is answered by handing `items` back in the old order. */
  reorder: [ids: string[]]
}>()

defineSlots<{
  /** One `ScreenRow` per item. `order` counts from 1. */
  default: (props: { item: T, order: number }) => unknown
}>()

/** The id of the opened row. One row is open at a time. */
const open = defineModel<string>('open')

interface Lift {
  id: string
  by: LiftedBy
  /** Where the rows stand while the lift lasts. Only a keyboard lift moves them before the drop. */
  ids: string[]
}

interface Landing {
  targetId: string
  edge: DropEdge
  ids: string[]
}

const givenIds = computed(() => props.items.map(item => item.id))
const lift = ref<Lift>()
const landing = ref<Landing>()
const said = ref('')

const shown = computed(() => {
  if (lift.value?.by !== 'keyboard')
    return props.items
  const byId = new Map(props.items.map(item => [item.id, item]))
  return lift.value.ids.map(id => byId.get(id)!)
})
const shownIds = computed(() => shown.value.map(item => item.id))

/** The last order emitted, with the one it replaced: an owner whose save was rejected hands that one back. */
let settled: { id: string, before: string[] } | undefined

watch(givenIds, (given) => {
  lift.value = undefined
  landing.value = undefined
  if (settled && sameOrder(given, settled.before)) {
    sayPlace(settled.id, given)
    settled = undefined
  }
  keepFocusInRows()
})

const rowElements = new Map<string, HTMLElement>()
const nameOf = (id: string) => props.items.find(item => item.id === id)?.name ?? ''

function sayPlace(id: string, ids: string[]) {
  said.value = `${nameOf(id)}, Order ${ids.indexOf(id) + 1} of ${ids.length}`
}

/** A row that moves in the page can lose the focus on the way; while this is set, a grip that loses it is not being left. */
let returningFocus = false

async function returnFocusTo(id: string, ...controls: string[]) {
  returningFocus = true
  await nextTick()
  const row = rowElements.get(id)
  controls
    .map(control => row?.querySelector<HTMLButtonElement>(control))
    .find(control => control && !control.disabled)
    ?.focus()
  returningFocus = false
}

/** Rows that change places under the admin, as when a rejected save puts them back, must not take the focus away from the control it is on. */
async function keepFocusInRows() {
  const focused = document.activeElement
  if (!(focused instanceof HTMLElement) || ![...rowElements.values()].some(row => row.contains(focused)))
    return
  returningFocus = true
  await nextTick()
  if (focused.isConnected && document.activeElement !== focused)
    focused.focus()
  returningFocus = false
}

const GRIP = '[data-grip]'
const moveButton = (by: Step) => by < 0 ? '[data-move="earlier"]' : '[data-move="later"]'

function settle(id: string, ids: string[]) {
  if (sameOrder(ids, givenIds.value))
    return
  sayPlace(id, ids)
  settled = { id, before: givenIds.value }
  emit('reorder', ids)
}

function putBack() {
  const lifted = lift.value
  lift.value = undefined
  if (lifted && !sameOrder(lifted.ids, givenIds.value))
    sayPlace(lifted.id, givenIds.value)
}

const LIFT_KEYS = ['Enter', ' ']
const MOVE_KEYS: Record<string, Step> = { ArrowUp: -1, ArrowDown: 1 }

function dropLifted(lifted: Lift) {
  lift.value = undefined
  settle(lifted.id, lifted.ids)
}

function moveLifted(lifted: Lift, by: Step) {
  const ids = movedBy(lifted.ids, lifted.id, by)
  if (sameOrder(ids, lifted.ids))
    return
  lift.value = { ...lifted, ids }
  sayPlace(lifted.id, ids)
}

function actionOnLifted(lifted: Lift, key: string) {
  if (LIFT_KEYS.includes(key))
    return () => dropLifted(lifted)
  if (key in MOVE_KEYS)
    return () => moveLifted(lifted, MOVE_KEYS[key])
  return key === 'Escape' ? putBack : undefined
}

function pressGrip(id: string, event: KeyboardEvent) {
  const lifted = lift.value?.by === 'keyboard' && lift.value.id === id ? lift.value : undefined
  const liftRow = () => {
    lift.value = { id, by: 'keyboard', ids: givenIds.value }
  }
  const action = lifted ? actionOnLifted(lifted, event.key) : LIFT_KEYS.includes(event.key) ? liftRow : undefined
  if (!action)
    return
  event.preventDefault()
  action()
  returnFocusTo(id, GRIP)
}

function leaveGrip(id: string) {
  if (!returningFocus && lift.value?.by === 'keyboard' && lift.value.id === id)
    putBack()
}

function nudge(id: string, by: Step) {
  settle(id, movedBy(givenIds.value, id, by))
  returnFocusTo(id, moveButton(by), moveButton(by < 0 ? 1 : -1))
}

/** Tells this list's rows from those of another list on the page, which must not be dropped here. */
const listKey = Symbol('ScreenRows')

function edgeUnder(pointerY: number, row: Element): DropEdge {
  const { top, height } = row.getBoundingClientRect()
  return pointerY < top + height / 2 ? 'before' : 'after'
}

interface DropTargetData {
  id: string
  edge: DropEdge
}

/** Where the lifted row would land if it were dropped on the innermost row under the pointer; nothing when that is where it stands. */
function landingOf(lifted: string, target: DropTargetData | undefined): Landing | undefined {
  if (!target)
    return undefined
  const ids = droppedAt(givenIds.value, lifted, target.id, target.edge)
  return sameOrder(ids, givenIds.value) ? undefined : { targetId: target.id, edge: target.edge, ids }
}

function attach(id: string, row: HTMLElement) {
  rowElements.set(id, row)
  const grip = row.querySelector<HTMLElement>(GRIP)
  if (!grip)
    return () => rowElements.delete(id)
  const targetUnder = (targets: { data: Record<string | symbol, unknown> }[]) => targets[0]?.data as unknown as DropTargetData | undefined

  const detach = combine(
    draggable({
      element: grip,
      getInitialData: () => ({ list: listKey, id }),
      onGenerateDragPreview({ nativeSetDragImage, location }) {
        const { left, top } = row.getBoundingClientRect()
        nativeSetDragImage?.(row, location.initial.input.clientX - left, location.initial.input.clientY - top)
      },
      onDragStart() {
        lift.value = { id, by: 'pointer', ids: givenIds.value }
      },
      onDrag({ location }) {
        landing.value = landingOf(id, targetUnder(location.current.dropTargets))
      },
      onDrop({ location }) {
        const landed = landingOf(id, targetUnder(location.current.dropTargets))
        lift.value = undefined
        landing.value = undefined
        if (landed)
          settle(id, landed.ids)
      },
    }),
    dropTargetForElements({
      element: row,
      canDrop: ({ source }) => source.data.list === listKey,
      getData: ({ input }): Record<string, unknown> => ({ id, edge: edgeUnder(input.clientY, row) }),
    }),
  )

  return () => {
    detach()
    if (rowElements.get(id) === row)
      rowElements.delete(id)
  }
}

watchEffect((onCleanup) => {
  if (props.sortable)
    onCleanup(autoScrollWindowForElements({ canScroll: ({ source }) => source.data.list === listKey }))
})

const gripHelpId = useId()

provide(screenRowsKey, {
  sortable: computed(() => props.sortable),
  total: computed(() => props.items.length),
  gripHelpId,
  orderOf: id => shownIds.value.indexOf(id) + 1,
  liftedBy: id => props.force?.lifted === id ? props.force.by ?? 'pointer' : lift.value?.id === id ? lift.value.by : undefined,
  gripForce: id => props.force?.lifted === id && props.force.by === 'keyboard' ? 'focus' : undefined,
  dropEdgeOf(id) {
    if (props.force?.dropBefore === id)
      return 'before'
    if (props.force?.dropAfter === id)
      return 'after'
    return landing.value?.targetId === id ? landing.value.edge : undefined
  },
  pressGrip,
  leaveGrip,
  nudge,
  attach,
})
</script>

<template>
  <div class="screen-rows">
    <AccordionRoot v-model="open" as-child type="single" collapsible>
      <ul class="rows">
        <template v-for="(item, index) in shown" :key="item.id">
          <slot :item="item" :order="index + 1" />
        </template>
      </ul>
    </AccordionRoot>
    <template v-if="sortable">
      <p class="visually-hidden" role="status">
        {{ said }}
      </p>
      <p :id="gripHelpId" hidden>
        Space or Enter lifts the row, the arrow keys move it, Space or Enter drops it, Escape puts it back.
      </p>
    </template>
  </div>
</template>
