<script setup lang="ts">
withDefaults(defineProps<{
  /** The text alternative of a mark that stands alone. */
  label?: string
  /** For a mark that sits beside text saying what is loading, or inside a control that keeps its name. */
  decorative?: boolean
}>(), {
  label: 'Loading',
})
</script>

<template>
  <span
    class="loading-mark"
    :role="decorative ? undefined : 'img'"
    :aria-label="decorative ? undefined : label"
    :aria-hidden="decorative || undefined"
  />
</template>

<style scoped>
@layer components {
  .loading-mark {
    display: inline-block;
    flex: none;
    width: var(--space-2);
    height: var(--space-2);
    background: currentColor;
    animation: blink 1s steps(1) infinite;
  }

  @keyframes blink {
    50% { opacity: 0; }
  }

  @media (prefers-reduced-motion: reduce) {
    .loading-mark {
      animation: none;
    }
  }
}
</style>
