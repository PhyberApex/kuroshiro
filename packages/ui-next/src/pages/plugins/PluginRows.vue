<script setup lang="ts">
import type { PluginSummary } from 'kuroshiro-shared'
import type { PluginRowState } from './pluginRows'
import type { RowMenuItem } from '@/components/rowMenuItem'
import { RouterLink } from 'vue-router'
import RowMenu from '@/components/RowMenu.vue'
import WashBar from '@/patterns/WashBar.vue'
import { pluginPath } from './pluginPaths'
import { kindAndOrigin, whereItShows } from './pluginRows'
import PluginRowStateCell from './PluginRowStateCell.vue'

export interface ShownPlugin {
  plugin: PluginSummary
  /** What the state column reads, which an action of the row's menu may replace for a moment. */
  state: PluginRowState | undefined
  actions: RowMenuItem[]
}

defineProps<{
  rows?: ShownPlugin[]
  /** The rows of a list that is still loading: bars where the text will be. */
  skeleton?: boolean
}>()

const SKELETON_ROWS = [['54%', '60%', '64%'], ['46%', '60%', '56%'], ['60%', '60%', '70%'], ['50%', '60%', '60%']]
</script>

<template>
  <ul v-if="skeleton" class="plugin-rows skeleton" aria-hidden="true">
    <li v-for="widths in SKELETON_ROWS" :key="widths[0]" class="plugin-row">
      <WashBar v-for="(width, cell) in widths" :key="cell" :width="width" />
    </li>
  </ul>
  <ul v-else class="plugin-rows">
    <li v-for="{ plugin, state, actions } in rows" :key="plugin.id" class="plugin-row">
      <RouterLink class="name" :to="pluginPath(plugin.id)">
        {{ plugin.name }}
      </RouterLink>
      <span class="soft">{{ kindAndOrigin(plugin) }}</span>
      <span class="soft">{{ whereItShows(plugin) }}</span>
      <PluginRowStateCell :state="state" />
      <span class="more">
        <RowMenu :label="`More actions for ${plugin.name}`" :items="actions" />
      </span>
    </li>
  </ul>
</template>

<style scoped>
@layer components {
  .plugin-rows.skeleton {
    border-top: var(--rule-heavy);
  }

  .plugin-row {
    position: relative;
    display: grid;
    grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1.45fr) var(--control-height);
    align-items: center;
    gap: var(--space-4);
    min-height: 3.25rem;
    padding: var(--space-2) 0;
    border-bottom: var(--rule);
  }

  /* The whole row leads to the Plugin: its name is the link and covers the row, under the menu button. */
  .name {
    font-weight: var(--weight-semibold);
    text-decoration: none;
    overflow-wrap: anywhere;
  }

  .name::after {
    content: '';
    position: absolute;
    inset: 0;
  }

  .plugin-row:hover .name {
    text-decoration: underline;
    text-underline-offset: 3px;
  }

  .name:focus-visible {
    outline: 0;
  }

  .plugin-row:has(.name:focus-visible) {
    outline: var(--focus-ring);
    outline-offset: var(--focus-offset);
    border-radius: var(--radius);
  }

  .soft {
    color: var(--color-ink-soft);
    font-size: var(--text-sm);
    overflow-wrap: anywhere;
  }

  .more {
    position: relative;
    z-index: 1;
  }

  @media (max-width: 820px) {
    .plugin-row {
      grid-template-columns: minmax(0, 1fr) var(--hit-target);
      gap: 2px var(--space-3);
      padding: var(--space-3) 0;
    }

    .plugin-row > * {
      grid-column: 1;
    }

    .plugin-row > .more {
      grid-column: 2;
      grid-row: 1 / span 4;
      align-self: start;
    }
  }
}
</style>
