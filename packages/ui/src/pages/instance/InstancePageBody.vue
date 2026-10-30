<script setup lang="ts">
defineSlots<{
  /** The sentence under the page's name that says what the page is for. */
  lede: () => unknown
  /** The page's sections; the first one carries `class="first"`, which stands it closer to the lede. */
  default: () => unknown
}>()
</script>

<template>
  <div class="body">
    <p class="lede">
      <slot name="lede" />
    </p>
    <slot />
  </div>
</template>

<style scoped>
@layer components {
  .body {
    margin-top: var(--space-3);
  }

  .lede {
    max-width: var(--measure);
    color: var(--color-ink-soft);
    text-wrap: pretty;
  }

  .body :deep(.first) {
    margin-top: var(--space-8);
  }
}
</style>
