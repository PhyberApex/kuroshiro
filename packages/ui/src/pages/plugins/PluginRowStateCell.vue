<script setup lang="ts">
import type { PluginRowState } from './pluginRows'
import Icon from '@/components/Icon.vue'

defineProps<{
  /** Left out, nothing is wrong and the cell is empty. */
  state?: PluginRowState
}>()
</script>

<template>
  <span class="row-state" :class="state?.kind">
    <template v-if="state">
      <span v-if="state.kind === 'alert'" class="square" aria-hidden="true" />
      <Icon v-else-if="state.kind === 'problem'" name="problem" class="mark" />
      <span>{{ state.text }}</span>
    </template>
  </span>
</template>

<style scoped>
@layer components {
  .row-state {
    font-size: var(--text-sm);
    overflow-wrap: anywhere;
  }

  .row-state.note {
    color: var(--color-ink-soft);
  }

  .row-state.alert,
  .row-state.problem {
    display: inline-flex;
    align-items: flex-start;
    gap: var(--space-2);
    font-weight: var(--weight-medium);
  }

  /* The seal colour is rationed: of a row's states only a firing Alert wears it. */
  .row-state.alert {
    color: var(--color-seal);
  }

  .square {
    flex: none;
    width: var(--space-2);
    height: var(--space-2);
    margin: calc((1lh - var(--space-2)) / 2) var(--space-1) 0;
    background: var(--color-seal);
  }

  .row-state .mark {
    flex: none;
    margin-top: calc((1lh - var(--icon)) / 2);
  }

  @media (max-width: 820px) {
    .row-state:empty {
      display: none;
    }
  }
}
</style>
