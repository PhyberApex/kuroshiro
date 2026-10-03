<script setup lang="ts">
import { ref } from 'vue'
import Specimen from '@/gallery/Specimen.vue'
import SpecimenRow from '@/gallery/SpecimenRow.vue'
import SaveState from './SaveState.vue'
import Switch from './Switch.vue'

const off = ref(false)
const on = ref(true)
</script>

<template>
  <SpecimenRow title="Off">
    <Specimen caption="default">
      <Switch v-model="off">
        Schedule
      </Switch>
    </Specimen>
    <Specimen caption="hover">
      <Switch v-model="off" data-force="hover">
        Schedule
      </Switch>
    </Specimen>
    <Specimen caption="focus">
      <Switch v-model="off" data-force="focus">
        Schedule
      </Switch>
    </Specimen>
    <Specimen caption="disabled">
      <Switch v-model="off" disabled>
        Schedule
      </Switch>
    </Specimen>
    <Specimen caption="error">
      <Switch v-model="off" error>
        Sleep Mode
        <template #status>
          <SaveState status="failed" />
        </template>
      </Switch>
    </Specimen>
  </SpecimenRow>

  <SpecimenRow title="On">
    <Specimen caption="default">
      <Switch v-model="on">
        Schedule
      </Switch>
    </Specimen>
    <Specimen caption="hover">
      <Switch v-model="on" data-force="hover">
        Schedule
      </Switch>
    </Specimen>
    <Specimen caption="focus">
      <Switch v-model="on" data-force="focus">
        Schedule
      </Switch>
    </Specimen>
    <Specimen caption="disabled">
      <Switch v-model="on" disabled>
        Schedule
      </Switch>
    </Specimen>
    <Specimen caption="saving">
      <Switch v-model="on" saving>
        Sleep Mode
        <template #status>
          <SaveState status="saving" />
        </template>
      </Switch>
    </Specimen>
    <Specimen caption="error">
      <Switch v-model="on" error>
        Sleep Mode
        <template #status>
          <SaveState status="failed" />
        </template>
      </Switch>
    </Specimen>
    <Specimen caption="without a visible label">
      <Switch v-model="on" aria-label="Schedule" />
    </Specimen>
  </SpecimenRow>
</template>
