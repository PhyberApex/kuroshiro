<script setup lang="ts">
import { ref } from 'vue'
import Specimen from '@/gallery/Specimen.vue'
import SpecimenRow from '@/gallery/SpecimenRow.vue'
import DateInput from './DateInput.vue'

const value = ref<string | null>('2026-10-03')
const empty = ref<string | null>(null)
</script>

<template>
  <SpecimenRow>
    <Specimen caption="default">
      <DateInput v-model="value" aria-label="From" />
    </Specimen>
    <Specimen caption="empty">
      <DateInput v-model="empty" aria-label="From" />
    </Specimen>
    <Specimen caption="hover">
      <DateInput v-model="value" aria-label="From" data-force="hover" />
    </Specimen>
    <Specimen caption="focus">
      <DateInput v-model="value" aria-label="From" data-force="focus" />
    </Specimen>
    <Specimen caption="disabled">
      <DateInput v-model="value" aria-label="From" disabled />
    </Specimen>
    <Specimen caption="invalid">
      <DateInput v-model="value" aria-label="From" invalid />
    </Specimen>
    <Specimen caption="with the place of the save state">
      <DateInput v-model="value" aria-label="From">
        <template #status>
          <span class="state">Saved</span>
        </template>
      </DateInput>
    </Specimen>
  </SpecimenRow>
</template>

<style scoped>
@layer components {
  .state {
    color: var(--color-ink-soft);
    font-size: var(--text-sm);
  }
}
</style>
