<script setup lang="ts">
import Specimen from '@/gallery/Specimen.vue'
import SpecimenRow from '@/gallery/SpecimenRow.vue'
import LoadingLine from './LoadingLine.vue'
import WashBar from './WashBar.vue'
</script>

<template>
  <SpecimenRow>
    <Specimen caption="the one loading line of a view">
      <LoadingLine>Loading Kitchen's Screens</LoadingLine>
    </Specimen>
    <Specimen caption="wash bars, where text will be">
      <div class="bars">
        <WashBar width="9rem" />
        <WashBar width="14rem" />
        <WashBar width="6rem" />
      </div>
    </Specimen>
  </SpecimenRow>
</template>

<style scoped>
@layer components {
  .bars {
    display: grid;
    gap: var(--space-3);
    width: 14rem;
  }
}
</style>
