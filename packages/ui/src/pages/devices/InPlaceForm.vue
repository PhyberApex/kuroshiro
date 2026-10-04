<script setup lang="ts">
import { useId } from 'vue'

defineProps<{
  /** What the form does, which is also the name of the button that opened it: "Change layout". */
  title: string
}>()

defineSlots<{
  default?: () => unknown
  /** The primary button first, then the one that closes the form. */
  buttons?: () => unknown
}>()

const titleId = useId()
</script>

<template>
  <div class="in-place-form" role="group" :aria-labelledby="titleId">
    <p :id="titleId" class="title">
      {{ title }}
    </p>
    <slot />
    <div class="buttons">
      <slot name="buttons" />
    </div>
  </div>
</template>

<style scoped>
@layer components {
  .in-place-form {
    display: grid;
    gap: var(--space-3);
    min-width: 0;
    padding: var(--space-4);
    border: var(--rule-control);
    border-radius: var(--radius);
  }

  .title {
    font-weight: var(--weight-medium);
  }

  .buttons {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2) var(--space-4);
  }
}
</style>
