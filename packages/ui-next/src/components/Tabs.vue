<script setup lang="ts">
import type { NavItem } from './navItem'
import { RouterLink } from 'vue-router'

defineProps<{
  /** What the tabs are the views of, such as the Device's name. It names the navigation. */
  label: string
  items: NavItem[]
  /** For the gallery: the states held still on a tab, by its label, such as `{ Settings: 'hover' }`. */
  force?: Record<string, string>
}>()
</script>

<template>
  <nav class="tabs" :aria-label="label">
    <RouterLink
      v-for="item in items"
      :key="item.label"
      class="tab"
      :to="item.to"
      :data-force="force?.[item.label]"
    >
      {{ item.label }}
    </RouterLink>
  </nav>
</template>

<style scoped>
@layer components {
  .tabs {
    display: flex;
    gap: var(--space-3);
    margin-inline: calc(var(--space-1) * -1);
    border-bottom: var(--rule);
    overflow-x: auto;
    scrollbar-width: none;
  }

  .tab {
    display: flex;
    flex: none;
    align-items: center;
    min-height: max(2.25rem, var(--control-height));
    padding: 0 var(--space-1);
    border-bottom: 2px solid transparent;
    color: var(--color-ink-soft);
    font-weight: var(--weight-medium);
    text-decoration: none;
    white-space: nowrap;
    transition: color var(--duration-quick) var(--ease-out);
  }

  /* `data-force` holds a state still for the gallery, where no pointer is over the tab. */
  .tab:is(:hover, [data-force~='hover']) {
    color: var(--color-ink);
  }

  .tab[aria-current='page'] {
    border-bottom-color: var(--color-ink);
    color: var(--color-ink);
    font-weight: var(--weight-semibold);
  }

  /* The row scrolls sideways, which would cut a ring drawn outside the tab. */
  .tabs .tab:is(:focus-visible, [data-force~='focus']) {
    outline-offset: -2px;
  }
}
</style>
