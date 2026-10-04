<script setup lang="ts">
import Specimen from '@/gallery/Specimen.vue'
import SpecimenRow from '@/gallery/SpecimenRow.vue'
import Seal from './Seal.vue'
</script>

<template>
  <SpecimenRow title="Both characters, from 20 px up">
    <Specimen caption="64">
      <Seal :size="64" />
    </Specimen>
    <Specimen caption="40, the default">
      <Seal />
    </Specimen>
    <Specimen caption="28, ink: the bar">
      <Seal :size="28" colour="ink" />
    </Specimen>
    <Specimen caption="24">
      <Seal :size="24" />
    </Specimen>
    <Specimen caption="20, the smallest">
      <Seal :size="20" />
    </Specimen>
  </SpecimenRow>
  <SpecimenRow title="The second character alone, below 20 px">
    <Specimen caption="16: the Active Screen's row">
      <Seal :size="16" />
    </Specimen>
    <Specimen caption="16, ink">
      <Seal :size="16" colour="ink" />
    </Specimen>
    <Specimen caption="12">
      <Seal :size="12" />
    </Specimen>
  </SpecimenRow>
  <SpecimenRow title="Stamping">
    <Specimen caption="stamps once as it lands, in 200 ms; not at all where motion is reduced">
      <Seal :size="56" stamps />
    </Specimen>
  </SpecimenRow>
</template>
