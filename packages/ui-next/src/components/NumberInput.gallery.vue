<script setup lang="ts">
import { ref } from 'vue'
import Specimen from '@/gallery/Specimen.vue'
import SpecimenRow from '@/gallery/SpecimenRow.vue'
import NumberInput from './NumberInput.vue'

const value = ref<number | null>(900)
const empty = ref<number | null>(null)
</script>

<template>
  <SpecimenRow>
    <Specimen caption="default">
      <NumberInput v-model="value" aria-label="Refresh rate" />
    </Specimen>
    <Specimen caption="empty">
      <NumberInput v-model="empty" aria-label="Refresh rate" placeholder="Seconds" />
    </Specimen>
    <Specimen caption="hover">
      <NumberInput v-model="value" aria-label="Refresh rate" data-force="hover" />
    </Specimen>
    <Specimen caption="focus">
      <NumberInput v-model="value" aria-label="Refresh rate" data-force="focus" />
    </Specimen>
    <Specimen caption="disabled">
      <NumberInput v-model="value" aria-label="Refresh rate" disabled />
    </Specimen>
    <Specimen caption="invalid">
      <NumberInput v-model="value" aria-label="Refresh rate" invalid />
    </Specimen>
    <Specimen caption="with the place of the save state">
      <NumberInput v-model="value" aria-label="Refresh rate">
        <template #status>
          <span class="state">Saved</span>
        </template>
      </NumberInput>
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
