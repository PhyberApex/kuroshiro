<script setup lang="ts">
defineSlots<{
  /** The rows: one `SummaryRow` per label. */
  default: () => unknown
}>()
</script>

<template>
  <dl class="summary-list">
    <slot />
  </dl>
</template>

<style scoped>
@layer components {
  .summary-list {
    border-top: var(--rule-heavy);
  }
}
</style>
