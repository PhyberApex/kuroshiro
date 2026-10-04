<script setup lang="ts">
/** One section of a page: its heading on the heavy rule, with the section's action at the right. */
defineProps<{
  title: string
  /** The fragment the section answers to: `data` for `#data`. */
  id?: string
  /** The section holds Setting rows: they start at the heading's rule and end on a rule of their own. */
  rows?: boolean
}>()

defineSlots<{
  default: () => unknown
  /** The section's action, on the heading's line: "Add a Data Source". */
  actions?: () => unknown
  /** What is said about the whole section, under its rows. */
  under?: () => unknown
}>()
</script>

<template>
  <section :id="id" class="page-section">
    <div class="heading-line" :class="{ rows }">
      <h2 class="heading">
        {{ title }}
      </h2>
      <div v-if="$slots.actions" class="actions">
        <slot name="actions" />
      </div>
    </div>
    <div v-if="rows" class="rows">
      <slot />
    </div>
    <slot v-else />
    <p v-if="$slots.under" class="under">
      <slot name="under" />
    </p>
  </section>
</template>

<style scoped>
@layer components {
  .page-section {
    margin-top: var(--space-10);
    scroll-margin-top: var(--space-4);
  }

  .heading-line {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    justify-content: space-between;
    gap: var(--space-2) var(--space-4);
    margin-bottom: var(--space-5);
    padding-bottom: var(--space-2);
    border-bottom: var(--rule-heavy);
  }

  .heading-line.rows {
    margin-bottom: 0;
  }

  .rows {
    border-bottom: var(--rule);
  }

  .under {
    max-width: var(--measure);
    margin-top: var(--space-3);
    color: var(--color-ink-soft);
    text-wrap: pretty;
  }

  .heading {
    font-stretch: var(--width-title);
    font-weight: var(--weight-title);
    font-size: var(--title-sm);
    line-height: var(--leading-title);
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
  }
}
</style>
