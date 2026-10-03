<script setup lang="ts">
defineProps<{
  /** The state shown, as the inventory names it. */
  caption: string
  /** For a specimen that needs the whole row, such as the Server URL. */
  wide?: boolean
}>()
</script>

<template>
  <figure class="specimen" :class="{ wide }">
    <slot />
    <figcaption class="caption">
      {{ caption }}
    </figcaption>
  </figure>
</template>

<style scoped>
@layer components {
  .specimen {
    display: grid;
    align-content: end;
    justify-items: start;
    gap: var(--space-2);
    min-width: 0;
  }

  .wide {
    flex: 1 1 100%;
  }

  .caption {
    color: var(--color-ink-soft);
    font-size: var(--text-xs);
  }
}
</style>
