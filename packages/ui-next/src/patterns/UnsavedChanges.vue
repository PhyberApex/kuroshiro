<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import Confirmation from '@/components/Confirmation.vue'

const props = defineProps<{
  /** Whether the form holds changes that are not saved. */
  when: boolean
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

onBeforeRouteLeave(() => {
  if (!props.when)
    return true
  // A route change asked for while the question is open replaces the one it was asked about.
  settle(false)
  asking.value = true
  return new Promise<boolean>((resolve) => {
    answer = resolve
  })
})

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
