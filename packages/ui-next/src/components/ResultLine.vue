<script setup lang="ts">
import type { IconName } from './icons'
import Icon from './Icon.vue'
import LoadingMark from './LoadingMark.vue'

withDefaults(defineProps<{
  /** The action is still running: the loading mark stands where the icon will. */
  running?: boolean
  /** The icon of the finished action: the check for what worked, the problem icon for what did not. */
  icon?: IconName
}>(), {
  icon: 'check',
})

defineSlots<{
  /** One sentence: what is running, or what came of it. */
  default: () => unknown
}>()
</script>

<template>
  <p class="result-line" role="status">
    <LoadingMark v-if="running" class="mark running" decorative />
    <Icon v-else class="mark" :name="icon" />
    <span><slot /></span>
  </p>
</template>

<style scoped>
@layer components {
  .result-line {
    display: flex;
    align-items: flex-start;
    gap: var(--space-2);
    max-width: var(--measure);
  }

  /* Both marks sit on the middle of the first line: the icon is 16 px high and the loading mark 8 px. */
  .result-line .mark {
    margin-top: calc((1lh - var(--icon)) / 2);
  }

  .result-line .mark.running {
    margin-top: calc((1lh - var(--space-2)) / 2);
    margin-inline: var(--space-1);
  }
}
</style>
