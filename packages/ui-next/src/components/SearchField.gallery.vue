<script setup lang="ts">
import { ref } from 'vue'
import Specimen from '@/gallery/Specimen.vue'
import SpecimenRow from '@/gallery/SpecimenRow.vue'
import SearchField from './SearchField.vue'

const empty = ref('')
const query = ref('battery')
</script>

<template>
  <SpecimenRow>
    <Specimen caption="empty">
      <SearchField v-model="empty" aria-label="Search messages" placeholder="Search messages" />
    </Specimen>
    <Specimen caption="filled">
      <SearchField v-model="query" aria-label="Search messages" placeholder="Search messages" />
    </Specimen>
    <Specimen caption="focus">
      <SearchField v-model="query" aria-label="Search messages" placeholder="Search messages" data-force="focus" />
    </Specimen>
    <Specimen caption="hover">
      <SearchField v-model="empty" aria-label="Find a Plugin" placeholder="Find a Plugin" data-force="hover" />
    </Specimen>
    <Specimen caption="disabled">
      <SearchField v-model="empty" aria-label="Find a Plugin" placeholder="Find a Plugin" disabled />
    </Specimen>
  </SpecimenRow>
</template>
