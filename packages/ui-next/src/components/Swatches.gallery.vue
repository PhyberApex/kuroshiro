<script setup lang="ts">
import Specimen from '@/gallery/Specimen.vue'
import SpecimenRow from '@/gallery/SpecimenRow.vue'
import Swatches from './Swatches.vue'

const GREYS = ['#000000', '#555555', '#aaaaaa', '#ffffff']
const SOFT_RED = ['#111111', '#b53a30', '#f2f0ea']
const SIX_COLOURS = ['#16141c', '#e6e6e0', '#9e2a22', '#3a6a3c', '#27407e', '#d8c13a']
</script>

<template>
  <SpecimenRow>
    <Specimen caption="greys, with the Palette's id beside them">
      <p class="named">
        <Swatches :colours="GREYS" /><span class="id">gray-4</span>
      </p>
    </Specimen>
    <Specimen caption="three colours, with the Palette Family beside them">
      <p class="named">
        <Swatches :colours="SOFT_RED" />Black, white and red
      </p>
    </Specimen>
    <Specimen caption="six colours">
      <p class="named">
        <Swatches :colours="SIX_COLOURS" />Six colours
      </p>
    </Specimen>
  </SpecimenRow>
</template>

<style scoped>
@layer components {
  .named {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    color: var(--color-ink-soft);
    font-size: var(--text-sm);
  }

  .id {
    font-family: var(--font-mono);
  }
}
</style>
