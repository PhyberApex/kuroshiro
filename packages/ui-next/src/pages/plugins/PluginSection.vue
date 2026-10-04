<script setup lang="ts">
/** One section of the Plugin page: its heading on the heavy rule, with the section's action at the right. */
defineProps<{
  title: string
  /** The fragment the section answers to: `data` for `#data`. */
  id?: string
}>()

defineSlots<{
  default: () => unknown
  /** The section's action, on the heading's line: "Add a Data Source". */
  actions?: () => unknown
}>()
</script>

<template>
  <section :id="id" class="plugin-section">
    <div class="heading-line">
      <h2 class="heading">
        {{ title }}
      </h2>
      <div v-if="$slots.actions" class="actions">
        <slot name="actions" />
      </div>
    </div>
    <slot />
  </section>
</template>

<style scoped>
@layer components {
  .plugin-section {
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
