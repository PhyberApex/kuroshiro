<script setup lang="ts">
defineSlots<{
  /** The plate of the Current Screen. */
  plate: () => unknown
  /** The column beside it: under it on phone. */
  default: () => unknown
}>()
</script>

<template>
  <div class="hero-columns">
    <slot name="plate" />
    <div class="beside">
      <slot />
    </div>
  </div>
</template>

<style scoped>
@layer components {
  /* The plate's seal hangs over its top right corner by up to 14 px, which the space above and the gap beside it leave room for. */
  .hero-columns {
    display: grid;
    grid-template-columns: minmax(0, var(--plate-hero)) minmax(0, 1fr);
    align-items: start;
    gap: var(--space-12);
    margin-top: var(--space-8);
  }

  .beside {
    min-width: 0;
  }

  @media (max-width: 820px) {
    .hero-columns {
      grid-template-columns: minmax(0, 1fr);
      gap: var(--space-5);
      margin-top: var(--space-6);
    }
  }
}
</style>
