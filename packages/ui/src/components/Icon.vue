<script setup lang="ts">
import type { IconName } from './icons'
import { ICON_PATHS } from './icons'

defineProps<{
  name: IconName
  /** An icon is decorative unless it is given a label, which makes it an image with that name. */
  label?: string
}>()
</script>

<template>
  <svg
    class="icon"
    viewBox="0 0 16 16"
    focusable="false"
    :role="label ? 'img' : undefined"
    :aria-label="label"
    :aria-hidden="label ? undefined : true"
  >
    <path :d="ICON_PATHS[name]" />
  </svg>
</template>

<style scoped>
@layer components {
  .icon {
    flex: none;
    width: var(--icon);
    height: var(--icon);
    fill: currentColor;
    /* Cuts the counters of copy, search and problem; the other paths do not overlap themselves. */
    fill-rule: evenodd;
  }
}
</style>
