<script setup lang="ts">
import { ref } from 'vue'
import Specimen from '@/gallery/Specimen.vue'
import SpecimenRow from '@/gallery/SpecimenRow.vue'
import Button from './Button.vue'
import InlineEdit from './InlineEdit.vue'

const name = ref('Weather')
const editing = ref(false)

function needsName(value: string) {
  return value.trim() ? undefined : 'A Screen needs a name.'
}

function rename(value: string) {
  name.value = value
  editing.value = false
}
</script>

<template>
  <SpecimenRow>
    <Specimen caption="at rest: press Rename; Enter saves, Escape cancels">
      <span class="row">
        <b><InlineEdit v-model:editing="editing" :value="name" :label="`Name of ${name}`" :validate="needsName" @save="rename" /></b>
        <Button variant="quiet" @click="editing = true">Rename</Button>
      </span>
    </Specimen>
    <Specimen caption="editing">
      <InlineEdit editing value="Weather" label="Name of Weather" />
    </Specimen>
    <Specimen caption="invalid">
      <InlineEdit editing value="" label="Name of Weather" error="A Screen needs a name." />
    </Specimen>
    <Specimen caption="saving">
      <InlineEdit editing value="Weather at the lake" label="Name of Weather" saving />
    </Specimen>
  </SpecimenRow>
</template>

<style scoped>
@layer components {
  .row {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-3);
    min-height: var(--control-height);
  }
}
</style>
