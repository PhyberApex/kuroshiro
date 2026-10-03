<script setup lang="ts">
import { ref } from 'vue'
import Specimen from '@/gallery/Specimen.vue'
import SpecimenRow from '@/gallery/SpecimenRow.vue'
import Checkbox from './Checkbox.vue'

const off = ref(false)
const on = ref(true)
</script>

<template>
  <SpecimenRow title="Off">
    <Specimen caption="default">
      <Checkbox v-model="off">
        All day
      </Checkbox>
    </Specimen>
    <Specimen caption="hover">
      <Checkbox v-model="off" data-force="hover">
        All day
      </Checkbox>
    </Specimen>
    <Specimen caption="focus">
      <Checkbox v-model="off" data-force="focus">
        All day
      </Checkbox>
    </Specimen>
    <Specimen caption="disabled">
      <Checkbox v-model="off" disabled>
        All day
      </Checkbox>
    </Specimen>
    <Specimen caption="invalid">
      <Checkbox v-model="off" invalid>
        TRMNL OG
      </Checkbox>
    </Specimen>
  </SpecimenRow>

  <SpecimenRow title="On">
    <Specimen caption="default">
      <Checkbox v-model="on">
        All day
      </Checkbox>
    </Specimen>
    <Specimen caption="hover">
      <Checkbox v-model="on" data-force="hover">
        All day
      </Checkbox>
    </Specimen>
    <Specimen caption="focus">
      <Checkbox v-model="on" data-force="focus">
        All day
      </Checkbox>
    </Specimen>
    <Specimen caption="disabled">
      <Checkbox v-model="on" disabled>
        All day
      </Checkbox>
    </Specimen>
    <Specimen caption="without a visible label">
      <Checkbox v-model="on" aria-label="Images no Screen uses" />
    </Specimen>
  </SpecimenRow>
</template>
