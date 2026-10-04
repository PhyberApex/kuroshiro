<script setup lang="ts">
defineSlots<{
  /** The choice that decides which form is shown: a radio row. */
  choice: () => unknown
  /** The form of what is chosen. */
  default: () => unknown
}>()
</script>

<template>
  <div class="choice-beside-form">
    <slot name="choice" />
    <div class="chosen">
      <slot />
    </div>
  </div>
</template>

<style scoped>
@layer components {
  .choice-beside-form {
    display: grid;
    grid-template-columns: 17rem minmax(0, 34rem);
    align-items: start;
    gap: var(--space-8) var(--space-12);
    border-top: var(--rule-heavy);
  }

  .chosen {
    padding-top: var(--space-3);
  }

  @media (max-width: 820px) {
    .choice-beside-form {
      grid-template-columns: minmax(0, 1fr);
    }

    .chosen {
      padding-top: 0;
    }
  }
}
</style>
