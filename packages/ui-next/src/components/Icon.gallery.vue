<script setup lang="ts">
import Specimen from '@/gallery/Specimen.vue'
import SpecimenRow from '@/gallery/SpecimenRow.vue'
import Icon from './Icon.vue'
import { ICON_NAMES } from './icons'
</script>

<template>
  <SpecimenRow>
    <Specimen v-for="name in ICON_NAMES" :key="name" :caption="name">
      <Icon :name="name" />
    </Specimen>
  </SpecimenRow>
</template>
