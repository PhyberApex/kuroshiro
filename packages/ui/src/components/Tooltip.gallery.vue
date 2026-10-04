<script setup lang="ts">
import Specimen from '@/gallery/Specimen.vue'
import SpecimenRow from '@/gallery/SpecimenRow.vue'
import Tooltip from './Tooltip.vue'
</script>

<template>
  <SpecimenRow>
    <Specimen caption="closed, on a relative time: hover or focus it">
      <Tooltip text="3 October 2026 at 14:02">
        <span tabindex="0">4 min ago</span>
      </Tooltip>
    </Specimen>
    <Specimen caption="open, on a cut-off Device name">
      <Tooltip text="Kitchen, beside the window" open>
        <span class="cut-off" tabindex="0">Kitchen, beside the window</span>
      </Tooltip>
    </Specimen>
  </SpecimenRow>
</template>

<style scoped>
@layer components {
  .cut-off {
    max-width: 16ch;
    margin-top: var(--space-8);
    overflow: hidden;
    font-weight: var(--weight-semibold);
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
</style>
