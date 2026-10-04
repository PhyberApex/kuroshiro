<script setup lang="ts">
import WashBar from '@/patterns/WashBar.vue'

const ROW_WIDTHS = ['62%', '48%', '56%']
</script>

<template>
  <div class="skeleton" aria-hidden="true">
    <div v-for="width in ROW_WIDTHS" :key="width" class="skeleton-row">
      <WashBar width="70%" />
      <WashBar :width="width" />
      <WashBar class="end" width="100%" />
    </div>
  </div>
</template>

<style scoped>
@layer components {
  .skeleton-row {
    display: grid;
    grid-template-columns: var(--library-name-width) minmax(0, 1fr) 7rem;
    align-items: center;
    gap: var(--space-4);
    min-height: 3.25rem;
    border-bottom: var(--rule);
  }

  @media (max-width: 820px) {
    .skeleton-row {
      grid-template-columns: minmax(0, 1fr);
      align-content: center;
      gap: var(--space-2);
    }

    .skeleton-row .end {
      display: none;
    }
  }
}
</style>
