<script setup lang="ts">
import type { BarEntry } from './barEntries'
import { RouterLink } from 'vue-router'
import Tooltip from '@/components/Tooltip.vue'

defineProps<{
  entry: BarEntry
  current: boolean
  /** For the gallery: holds the tooltip of a cut name open. */
  tooltipOpen?: boolean
}>()
</script>

<template>
  <Tooltip v-if="entry.fullName" :text="entry.fullName" :open="tooltipOpen || undefined">
    <RouterLink class="bar-link" :to="entry.to" :aria-current="current ? 'page' : undefined">
      <span aria-hidden="true">{{ entry.label }}</span>
      <span class="visually-hidden">{{ entry.fullName }}</span>
    </RouterLink>
  </Tooltip>
  <RouterLink v-else class="bar-link" :to="entry.to" :aria-current="current ? 'page' : undefined">
    {{ entry.label }}
  </RouterLink>
</template>

<style scoped>
@layer components {
  .bar-link {
    display: flex;
    align-items: center;
    /* The underline of the current entry sits on the bar's bottom rule. */
    margin-bottom: -1px;
    border-bottom: 2px solid transparent;
    color: var(--color-ink-soft);
    font-weight: var(--weight-medium);
    text-decoration: none;
    white-space: nowrap;
    transition: color var(--duration-quick) var(--ease-out);
  }

  .bar-link:hover,
  .bar-link[data-force~='hover'] {
    color: var(--color-ink);
  }

  .bar-link[aria-current] {
    border-bottom-color: var(--color-ink);
    color: var(--color-ink);
    font-weight: var(--weight-semibold);
  }

  .bar-link:focus-visible,
  .bar-link[data-force~='focus'] {
    outline-offset: -2px;
  }
}
</style>
