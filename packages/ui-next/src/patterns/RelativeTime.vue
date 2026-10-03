<script setup lang="ts">
import { computed } from 'vue'
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
</script>

<template>
  <Tooltip v-if="relative" :text="exact">
    <time class="relative-time" :datetime="at">{{ relative }}</time>
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
