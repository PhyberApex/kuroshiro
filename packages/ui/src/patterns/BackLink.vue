<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'
import { RouterLink } from 'vue-router'

defineProps<{
  to: RouteLocationRaw
}>()

defineSlots<{
  /** Where the link leads back to: "Kitchen's Screens". */
  default: () => unknown
}>()
</script>

<template>
  <RouterLink class="back-link" :to="to">
    <svg class="mark" viewBox="0 0 16 16" focusable="false" aria-hidden="true">
      <path d="M10.6 3.2 5.8 8l4.8 4.8-1.1 1.1L3.6 8l5.9-5.9z" />
    </svg>
    <slot />
  </RouterLink>
</template>

<style scoped>
@layer components {
  .back-link {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    color: var(--color-ink-soft);
    font-size: var(--text-sm);
    text-underline-offset: 3px;
    transition: color var(--duration-quick) var(--ease-out);
  }

  .back-link:hover {
    color: var(--color-ink);
  }

  .mark {
    flex: none;
    width: var(--icon);
    height: var(--icon);
    fill: currentColor;
  }
}
</style>
