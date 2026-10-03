<script setup lang="ts">
import { ref } from 'vue'
import Specimen from '@/gallery/Specimen.vue'
import SpecimenRow from '@/gallery/SpecimenRow.vue'
import SaveState from './SaveState.vue'
import Switch from './Switch.vue'
import TextInput from './TextInput.vue'
import { useSaveAsChanged } from './useSaveAsChanged'

const name = ref('Hallway')
const sleepMode = ref(true)

const SERVER_DELAY_MS = 900
const afterAWhile = () => new Promise(resolve => setTimeout(resolve, SERVER_DELAY_MS))

const liveName = ref('Kitchen')
const nameSave = useSaveAsChanged(async (value: string) => {
  await afterAWhile()
  if (!value.trim())
    throw new Error('A Device needs a name.')
  return value.trim()
}, liveName)
</script>

<template>
  <SpecimenRow>
    <Specimen caption="saving">
      <SaveState status="saving" />
    </Specimen>
    <Specimen caption="saved, gone after 2 seconds">
      <SaveState status="saved" />
    </Specimen>
    <Specimen caption="not saved">
      <SaveState status="failed" />
    </Specimen>
    <Specimen caption="not saved, with the reason">
      <SaveState status="failed" reason="Kuroshiro's server is not answering." />
    </Specimen>
  </SpecimenRow>

  <SpecimenRow title="Beside a control">
    <Specimen caption="saving">
      <TextInput v-model="name" aria-label="Name" prose>
        <template #status>
          <SaveState status="saving" />
        </template>
      </TextInput>
    </Specimen>
    <Specimen caption="saved">
      <TextInput v-model="name" aria-label="Name" prose>
        <template #status>
          <SaveState status="saved" />
        </template>
      </TextInput>
    </Specimen>
    <Specimen caption="not saved">
      <Switch v-model="sleepMode" error>
        Sleep Mode
        <template #status>
          <SaveState status="failed" />
        </template>
      </Switch>
    </Specimen>
  </SpecimenRow>

  <SpecimenRow title="Driven by a save">
    <Specimen caption="change the name and leave the field; an empty name is refused">
      <TextInput v-model="liveName" aria-label="Name of the Device" prose @commit="nameSave.commit">
        <template #status>
          <SaveState :status="nameSave.status" :reason="nameSave.reason" @retry="nameSave.retry" />
        </template>
      </TextInput>
    </Specimen>
  </SpecimenRow>
</template>
