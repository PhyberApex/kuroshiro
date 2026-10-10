<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate } from 'vue-router'
import Confirmation from '@/components/Confirmation.vue'

const props = defineProps<{
  /** Whether the form holds changes that are not saved. */
  when: boolean
  /** Query keys whose change counts as leaving even while the path stays the same: switching which custom Palette's form is open. */
  leavesOnQuery?: string[]
}>()

defineSlots<{
  /** What is lost: "Your changes to Weather's template and Data Sources." */
  lost?: () => unknown
}>()

const asking = ref(false)
let answer: ((leave: boolean) => void) | undefined

function settle(leave: boolean) {
  answer?.(leave)
  answer = undefined
}

function ask() {
  // A question asked while one is open replaces the one it was asked about.
  settle(false)
  asking.value = true
  return new Promise<boolean>((resolve) => {
    answer = resolve
  })
}

/** Held while an action the admin already chose to leave for is running, so that its navigation is not asked about again. */
let leaving = false

const mayLeave = () => !props.when || leaving || ask()

onBeforeRouteLeave(mayLeave)
// Another record of the same route (another Plugin's page) is a way out too; a query or a fragment is the same page,
// unless it switches a query key named by `leavesOnQuery` to another value (which form of the same kind is open).
// The key going away rather than switching (Cancel, a save) is not a switch, and does not ask.
onBeforeRouteUpdate((to, from) => {
  const leavesByQuery = (props.leavesOnQuery ?? []).some(key => to.query[key] != null && to.query[key] !== from.query[key])
  return (to.path === from.path && !leavesByQuery) || mayLeave()
})

/**
 * For an action that counts as leaving without being a route change of its own (duplicating,
 * exporting): asks first while there are unsaved changes, and runs `action` unless the admin
 * keeps editing.
 */
async function leaveFor(action: () => unknown) {
  if (props.when && !(await ask()))
    return
  leaving = true
  try {
    await action()
  }
  finally {
    leaving = false
  }
}

defineExpose({ leaveFor })

function closed(open: boolean) {
  asking.value = open
  if (!open)
    settle(false)
}

// The browser words this question itself; it only needs to know that there is one to ask.
function askBeforeUnload(event: BeforeUnloadEvent) {
  if (props.when)
    event.preventDefault()
}

onMounted(() => window.addEventListener('beforeunload', askBeforeUnload))
onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', askBeforeUnload)
  settle(false)
})
</script>

<template>
  <Confirmation
    :open="asking"
    title="Leave without saving?"
    confirm-label="Leave"
    safe-label="Keep editing"
    :action="() => settle(true)"
    @update:open="closed"
  >
    <template v-if="$slots.lost" #lost>
      <slot name="lost" />
    </template>
  </Confirmation>
</template>
