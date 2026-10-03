<script setup lang="ts">
import type { Weekday } from './WeekdayToggle.vue'
import { ref } from 'vue'
import Specimen from '@/gallery/Specimen.vue'
import SpecimenRow from '@/gallery/SpecimenRow.vue'
import WeekdayToggle from './WeekdayToggle.vue'

const workdays = ref<Weekday[]>([1, 2, 3, 4, 5])
</script>

<template>
  <SpecimenRow>
    <Specimen caption="on and off">
      <WeekdayToggle v-model="workdays" aria-label="Days" />
    </Specimen>
    <Specimen caption="hover, on Wednesday and off Saturday">
      <WeekdayToggle v-model="workdays" aria-label="Days" :force="{ 3: 'hover', 6: 'hover' }" />
    </Specimen>
    <Specimen caption="focus, on Monday">
      <WeekdayToggle v-model="workdays" aria-label="Days" :force="{ 1: 'focus' }" />
    </Specimen>
    <Specimen caption="disabled">
      <WeekdayToggle v-model="workdays" aria-label="Days" disabled />
    </Specimen>
  </SpecimenRow>
</template>
