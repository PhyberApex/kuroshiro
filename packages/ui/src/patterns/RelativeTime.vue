<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, useTemplateRef } from 'vue'
import Tooltip from '@/components/Tooltip.vue'
import { exactTime, relativeTime } from './time'
import { useNow } from './useNow'

const props = defineProps<{
  /** An instant as a read model gives it: an ISO 8601 string. */
  at: string
}>()

const now = useNow()
const instant = computed(() => new Date(props.at))
const relative = computed(() => relativeTime(instant.value, now.value))
const exact = computed(() => exactTime(instant.value))

const trigger = useTemplateRef<HTMLElement>('trigger')

/** A RelativeTime already sitting in a link or a button (fifteen of them do) stays unfocusable, so it never nests a second interactive element in one. */
const inInteractive = ref(false)
onMounted(() => {
  inInteractive.value = !!trigger.value?.closest('a, button')
})

const tapped = ref(false)

/** Reka's tooltip does not open on a touch pointer, so a tap toggles it open itself, holding `Tooltip`'s `open` prop. */
function toggleOnTap() {
  if (window.matchMedia('(pointer: coarse)').matches)
    tapped.value = !tapped.value
}

function closeOnOutsideTap(event: PointerEvent) {
  if (tapped.value && trigger.value && !trigger.value.contains(event.target as Node))
    tapped.value = false
}

onMounted(() => document.addEventListener('pointerdown', closeOnOutsideTap))
onUnmounted(() => document.removeEventListener('pointerdown', closeOnOutsideTap))
</script>

<template>
  <Tooltip v-if="relative" :text="exact" :open="tapped || undefined">
    <time
      ref="trigger"
      class="relative-time"
      :tabindex="inInteractive ? undefined : 0"
      :aria-description="exact"
      :datetime="at"
      @click="toggleOnTap"
    >{{ relative }}</time>
  </Tooltip>
  <time v-else class="relative-time" :datetime="at">{{ exact }}</time>
</template>

<style scoped>
@layer components {
  .relative-time {
    white-space: nowrap;
  }
}
</style>
