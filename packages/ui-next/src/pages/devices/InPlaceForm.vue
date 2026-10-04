<script setup lang="ts">
import { useId } from 'vue'

defineProps<{
  /** What the form does, which is also the name of the button that opened it: "Change layout". */
  title: string
}>()

const titleId = useId()
</script>

<template>
  <div class="in-place-form" role="group" :aria-labelledby="titleId">
    <p :id="titleId" class="title">
      {{ title }}
    </p>
    <slot />
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
}
</style>
