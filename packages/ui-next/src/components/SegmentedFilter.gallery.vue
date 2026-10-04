<script setup lang="ts">
import type { Segment } from './SegmentedFilter.vue'
import { ref } from 'vue'
import Specimen from '@/gallery/Specimen.vue'
import SpecimenRow from '@/gallery/SpecimenRow.vue'
import SegmentedFilter from './SegmentedFilter.vue'

type Level = 'all' | 'problems'
type Appearance = 'system' | 'light' | 'dark'
type Template = 'full' | 'half_horizontal' | 'half_vertical' | 'quadrant'

const levels: Segment<Level>[] = [
  { value: 'all', label: 'All' },
  { value: 'problems', label: 'Warnings and errors' },
]
const appearances: Segment<Appearance>[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]
const templates: Segment<Template>[] = [
  { value: 'full', label: 'Full' },
  { value: 'half_horizontal', label: 'Half horizontal', problem: 'does not parse' },
  { value: 'half_vertical', label: 'Half vertical', disabled: true },
  { value: 'quadrant', label: 'Quadrant' },
]

const removals: Segment<Template>[] = [
  { value: 'full', label: 'Full' },
  { value: 'half_vertical', label: 'Half vertical', removed: true },
  { value: 'quadrant', label: 'Quadrant', removed: true },
]

const level = ref<Level>('all')
const appearance = ref<Appearance>('light')
const template = ref<Template>('full')
const kept = ref<Template>('quadrant')
</script>

<template>
  <SpecimenRow>
    <Specimen caption="default">
      <SegmentedFilter v-model="level" :segments="levels" aria-label="Level" />
    </Specimen>
    <Specimen caption="hover">
      <SegmentedFilter v-model="level" :segments="levels" aria-label="Level" :force="{ problems: 'hover' }" />
    </Specimen>
    <Specimen caption="focus">
      <SegmentedFilter v-model="appearance" :segments="appearances" aria-label="Appearance" :force="{ light: 'focus' }" />
    </Specimen>
    <Specimen caption="disabled">
      <SegmentedFilter v-model="level" :segments="levels" aria-label="Level" disabled />
    </Specimen>
  </SpecimenRow>

  <SpecimenRow>
    <Specimen caption="a problem on a segment, and one segment disabled">
      <SegmentedFilter v-model="template" :segments="templates" aria-label="Template" />
    </Specimen>
    <Specimen caption="a removed segment, chosen and not">
      <SegmentedFilter v-model="kept" :segments="removals" aria-label="Kept" />
    </Specimen>
  </SpecimenRow>
</template>
