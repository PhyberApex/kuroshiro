<script setup lang="ts">
import Specimen from '@/gallery/Specimen.vue'
import SpecimenRow from '@/gallery/SpecimenRow.vue'
import IconButton from './IconButton.vue'
</script>

<template>
  <SpecimenRow>
    <Specimen caption="default">
      <IconButton icon="up" label="Move Calendar earlier" />
    </Specimen>
    <Specimen caption="hover">
      <IconButton icon="up" label="Move Weather earlier" data-force="hover" />
    </Specimen>
    <Specimen caption="focus">
      <IconButton icon="up" label="Move Weekend board earlier" data-force="focus" />
    </Specimen>
    <Specimen caption="disabled">
      <IconButton icon="up" label="Move Train departures earlier" disabled />
    </Specimen>
    <Specimen caption="tooltip">
      <IconButton icon="more" label="More actions for Weather" tooltip-open />
    </Specimen>
  </SpecimenRow>
</template>
