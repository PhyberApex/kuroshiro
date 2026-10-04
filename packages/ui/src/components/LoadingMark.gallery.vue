<script setup lang="ts">
import Specimen from '@/gallery/Specimen.vue'
import SpecimenRow from '@/gallery/SpecimenRow.vue'
import LoadingMark from './LoadingMark.vue'
</script>

<template>
  <SpecimenRow>
    <Specimen caption="alone, named “Loading”">
      <LoadingMark />
    </Specimen>
    <Specimen caption="beside what is loading">
      <span class="line"><LoadingMark decorative />Loading Kitchen's Screens</span>
    </Specimen>
  </SpecimenRow>
</template>

<style scoped>
@layer components {
  .line {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
  }
}
</style>
