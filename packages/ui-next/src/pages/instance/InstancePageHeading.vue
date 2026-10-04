<script setup lang="ts">
defineProps<{
  /** The page's name, as the Instance page list has it. */
  title: string
}>()

defineSlots<{
  /** The page's actions, at the right of its name: buttons, the primary one last. */
  actions?: () => unknown
}>()
</script>

<template>
  <header class="page-heading">
    <h2 class="title">
      {{ title }}
    </h2>
    <div v-if="$slots.actions" class="actions">
      <slot name="actions" />
    </div>
  </header>
</template>

<style scoped>
@layer components {
  .page-heading {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    justify-content: space-between;
    gap: var(--space-3) var(--space-4);
    padding-bottom: var(--space-2);
    border-bottom: var(--rule-heavy);
  }

  .title {
    font-stretch: var(--width-title);
    font-weight: var(--weight-title);
    font-size: var(--title-sm);
    line-height: var(--leading-title);
    text-wrap: balance;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
  }
}
</style>
