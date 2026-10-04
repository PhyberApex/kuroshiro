<script setup lang="ts">
import Specimen from '@/gallery/Specimen.vue'
import SpecimenRow from '@/gallery/SpecimenRow.vue'
import CopyValue from './CopyValue.vue'
</script>

<template>
  <SpecimenRow>
    <Specimen caption="default: press it for copied, which reverts after 2 s">
      <CopyValue value="A4:C1:38:5F:0B:9E" />
    </Specimen>
    <Specimen caption="copied">
      <CopyValue value="A4:C1:38:5F:0B:9E" copied />
    </Specimen>
    <Specimen caption="showing less than it copies">
      <CopyValue value="kuro_live_9f2c41d07ab35e68">
        ••••••••5e68
      </CopyValue>
    </Specimen>
  </SpecimenRow>
  <SpecimenRow title="Server URL">
    <Specimen caption="default" wide>
      <CopyValue value="http://kuroshiro.lan:3000" size="title" label="Copy URL" />
    </Specimen>
    <Specimen caption="copied" wide>
      <CopyValue value="http://kuroshiro.lan:3000" size="title" label="Copy URL" copied />
    </Specimen>
  </SpecimenRow>
</template>
