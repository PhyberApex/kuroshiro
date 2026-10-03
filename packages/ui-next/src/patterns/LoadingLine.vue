<script setup lang="ts">
import LoadingMark from '@/components/LoadingMark.vue'

withDefaults(defineProps<{
  /** Whether the line says anything yet. Its live region is in the page either way, so that what it then says is announced. */
  shown?: boolean
}>(), {
  shown: true,
})

defineSlots<{
  /** What is loading: "Loading Kitchen's Screens". */
  default: () => unknown
}>()
</script>

<template>
  <p class="loading-line" role="status">
    <template v-if="shown">
      <LoadingMark decorative />
      <slot />
    </template>
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
