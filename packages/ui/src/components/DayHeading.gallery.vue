<script setup lang="ts">
import Specimen from '@/gallery/Specimen.vue'
import SpecimenRow from '@/gallery/SpecimenRow.vue'
import DayHeading from './DayHeading.vue'
</script>

<template>
  <SpecimenRow>
    <Specimen caption="default: a day among the lines of a list" wide>
      <ul class="lines">
        <DayHeading>Today</DayHeading>
        <li>07:31 · Rendered Calendar</li>
        <li>07:16 · Rendered Weather</li>
        <DayHeading>Friday 2 October</DayHeading>
        <li>23:01 · Sleep Mode began</li>
      </ul>
    </Specimen>
  </SpecimenRow>
</template>

<style scoped>
@layer components {
  .lines {
    justify-self: stretch;
  }

  .lines > li:not(.day-heading) {
    padding: var(--space-2) 0;
    border-bottom: var(--rule);
    font-family: var(--font-mono);
    font-size: var(--text-sm);
  }
}
</style>
