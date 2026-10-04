<script setup lang="ts">
import Specimen from '@/gallery/Specimen.vue'
import SpecimenRow from '@/gallery/SpecimenRow.vue'
import EmptyPlate from './EmptyPlate.vue'
</script>

<template>
  <SpecimenRow>
    <Specimen caption="before a poll, a TRMNL OG's panel">
      <EmptyPlate class="sized">
        Nothing polled yet
      </EmptyPlate>
    </Specimen>
    <Specimen caption="a 4:3 panel">
      <EmptyPlate class="sized" :width="1872" :height="1404">
        Nothing polled yet
      </EmptyPlate>
    </Specimen>
  </SpecimenRow>
</template>

<style scoped>
@layer components {
  .sized {
    width: 15rem;
  }
}
</style>
