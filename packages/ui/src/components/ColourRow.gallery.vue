<script setup lang="ts">
import { ref } from 'vue'
import Specimen from '@/gallery/Specimen.vue'
import SpecimenRow from '@/gallery/SpecimenRow.vue'
import ColourRow from './ColourRow.vue'

const red = ref('#B53A30')
const paper = ref('#F2F0EA')
const half = ref('#B53A')
</script>

<template>
  <SpecimenRow>
    <Specimen caption="default">
      <ColourRow v-model="red" label="Colour 1" />
    </Specimen>
    <Specimen caption="close to the paper">
      <ColourRow v-model="paper" label="Colour 2" />
    </Specimen>
    <Specimen caption="focus">
      <ColourRow v-model="red" label="Colour 3" data-force="focus" />
    </Specimen>
    <Specimen caption="invalid: no colour until it is a whole #RRGGBB">
      <ColourRow v-model="half" label="Colour 4" invalid />
    </Specimen>
  </SpecimenRow>
</template>
