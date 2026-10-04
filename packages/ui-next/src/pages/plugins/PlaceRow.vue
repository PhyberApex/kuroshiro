<script setup lang="ts">
/** One row of the Devices section: what the Plugin is placed on, how it stands there, and the one thing to do. */
defineSlots<{
  name: () => unknown
  standing: () => unknown
  act: () => unknown
}>()
</script>

<template>
  <li class="place-row">
    <span class="name"><slot name="name" /></span>
    <span class="standing"><slot name="standing" /></span>
    <span class="act"><slot name="act" /></span>
  </li>
</template>

<style scoped>
@layer components {
  .place-row {
    display: grid;
    grid-template-columns: minmax(0, var(--setting-label-width, 12.5rem)) minmax(0, 1fr) auto;
    align-items: center;
    gap: var(--space-1) var(--space-4);
    min-height: 3.25rem;
    padding: var(--space-2) 0;
  }

  .place-row + .place-row {
    border-top: var(--rule);
  }

  .name {
    min-width: 0;
    font-weight: var(--weight-medium);
    overflow-wrap: anywhere;
  }

  .standing {
    min-width: 0;
    color: var(--color-ink-soft);
    font-size: var(--text-sm);
    text-wrap: pretty;
  }

  .act {
    display: flex;
    justify-content: flex-end;
  }

  @media (max-width: 820px) {
    .place-row {
      grid-template-columns: minmax(0, 1fr) auto;
    }

    .standing {
      grid-row: 2;
      grid-column: 1;
    }

    .act {
      grid-row: 1 / 3;
      grid-column: 2;
    }
  }
}
</style>
