<script setup lang="ts">
defineProps<{
  label: string
}>()

defineSlots<{
  /** What the row shows: a value that is read and not edited, or the button of an action. */
  default: () => unknown
  /** At the row's side, where a Setting says where its value comes from. */
  side?: () => unknown
  /** One or two sentences under the value. */
  note?: () => unknown
}>()
</script>

<template>
  <div class="read-row">
    <b class="label">{{ label }}</b>
    <div class="shown">
      <slot />
    </div>
    <div v-if="$slots.side" class="side">
      <slot name="side" />
    </div>
    <p v-if="$slots.note" class="note">
      <slot name="note" />
    </p>
  </div>
</template>

<style scoped>
@layer components {
  /* The grid of a Setting row, so a section that mixes the two keeps its columns. */
  .read-row {
    display: grid;
    grid-template-columns: var(--setting-label-width, 12.5rem) minmax(0, 1fr) auto;
    align-items: center;
    gap: var(--space-1) var(--space-4);
    min-height: 3.25rem;
    padding: var(--space-2) 0;
  }

  .read-row + .read-row {
    border-top: var(--rule);
  }

  .label {
    font-weight: var(--weight-medium);
  }

  .shown {
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .side {
    max-width: 17rem;
    color: var(--color-ink-soft);
    font-size: var(--text-sm);
    text-align: right;
    overflow-wrap: anywhere;
  }

  .note {
    grid-column: 2 / -1;
    max-width: var(--measure);
    color: var(--color-ink-soft);
    font-size: var(--text-sm);
  }

  @media (max-width: 820px) {
    .read-row {
      grid-template-columns: minmax(0, 1fr);
    }

    .note {
      grid-column: 1;
    }

    .side {
      max-width: none;
      text-align: left;
    }
  }
}
</style>
