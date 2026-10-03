<script setup lang="ts">
import { ref } from 'vue'
import Specimen from '@/gallery/Specimen.vue'
import SpecimenRow from '@/gallery/SpecimenRow.vue'
import TimeInput from './TimeInput.vue'

const value = ref<string | null>('23:00')
const empty = ref<string | null>(null)
</script>

<template>
  <SpecimenRow>
    <Specimen caption="default">
      <TimeInput v-model="value" aria-label="From" />
    </Specimen>
    <Specimen caption="empty">
      <TimeInput v-model="empty" aria-label="From" />
    </Specimen>
    <Specimen caption="hover">
      <TimeInput v-model="value" aria-label="From" data-force="hover" />
    </Specimen>
    <Specimen caption="focus">
      <TimeInput v-model="value" aria-label="From" data-force="focus" />
    </Specimen>
    <Specimen caption="disabled">
      <TimeInput v-model="value" aria-label="From" disabled />
    </Specimen>
    <Specimen caption="invalid">
      <TimeInput v-model="value" aria-label="From" invalid />
    </Specimen>
    <Specimen caption="with the place of the save state">
      <TimeInput v-model="value" aria-label="From">
        <template #status>
          <span class="state">Saved</span>
        </template>
      </TimeInput>
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
