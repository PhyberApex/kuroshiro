<script setup lang="ts">
import LoadingMark from '@/components/LoadingMark.vue'

defineSlots<{
  /** What is loading: "Loading Kitchen's Screens". */
  default: () => unknown
}>()
</script>

<template>
  <p class="loading-line" role="status">
    <LoadingMark decorative />
    <slot />
  </p>
</template>

<style scoped>
@layer components {
  .loading-line {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    color: var(--color-ink-soft);
  }
}
</style>
