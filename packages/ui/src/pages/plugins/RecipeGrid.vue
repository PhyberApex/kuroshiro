<script setup lang="ts">
defineSlots<{
  /** One `li` per card. */
  default: () => unknown
}>()
</script>

<template>
  <ul class="recipe-grid">
    <slot />
  </ul>
</template>

<style scoped>
@layer components {
  /* As many columns of at least 15 rem as the column holds; one on a phone. */
  .recipe-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(15rem, 100%), 1fr));
    gap: var(--space-8) var(--space-6);
  }
}
</style>
