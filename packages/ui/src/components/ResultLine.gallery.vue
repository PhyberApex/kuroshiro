<script setup lang="ts">
import Specimen from '@/gallery/Specimen.vue'
import SpecimenRow from '@/gallery/SpecimenRow.vue'
import ResultLine from './ResultLine.vue'
</script>

<template>
  <SpecimenRow>
    <Specimen caption="running">
      <ResultLine running>
        Sending the Test Notification
      </ResultLine>
    </Specimen>
    <Specimen caption="done">
      <ResultLine>
        Sent. Check where your notifications arrive.
      </ResultLine>
    </Specimen>
    <Specimen caption="done, and it did not work">
      <ResultLine icon="problem">
        The webhook answered 404 Not Found, so nothing was delivered.
      </ResultLine>
    </Specimen>
    <Specimen caption="a sentence of two lines" wide>
      <ResultLine>
        Synced 14 Device Models and 6 Palettes from TRMNL. Two Device Models are new, and one that no Device uses is no longer offered by TRMNL and was marked as deprecated.
      </ResultLine>
    </Specimen>
  </SpecimenRow>
</template>
