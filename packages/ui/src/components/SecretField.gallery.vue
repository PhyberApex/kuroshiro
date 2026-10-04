<script setup lang="ts">
import { ref } from 'vue'
import Specimen from '@/gallery/Specimen.vue'
import SpecimenRow from '@/gallery/SpecimenRow.vue'
import SecretField from './SecretField.vue'

const empty = ref('')
const typed = ref('kuro_live_9f2c41d0')
const replacement = ref('')
</script>

<template>
  <SpecimenRow>
    <Specimen caption="empty">
      <SecretField v-model="empty" aria-label="API key" placeholder="Not set" />
    </Specimen>
    <Specimen caption="typed">
      <SecretField v-model="typed" aria-label="API key" placeholder="Not set" />
    </Specimen>
    <Specimen caption="stored: press Replace for an empty input">
      <SecretField v-model="replacement" stored aria-label="API key" replace-label="Replace API key" />
    </Specimen>
    <Specimen caption="stored, disabled">
      <SecretField stored disabled aria-label="API key" replace-label="Replace API key" />
    </Specimen>
  </SpecimenRow>
</template>
