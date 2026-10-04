<script setup lang="ts">
import { ref } from 'vue'
import Specimen from '@/gallery/Specimen.vue'
import SpecimenRow from '@/gallery/SpecimenRow.vue'
import Field from './Field.vue'
import NumberInput from './NumberInput.vue'
import Textarea from './Textarea.vue'
import TextInput from './TextInput.vue'

const rate = ref<number | null>(900)
const tooShort = ref<number | null>(12)
const label = ref('')
const html = ref('<div class="note">\n  Back at 6\n</div>')
</script>

<template>
  <SpecimenRow>
    <Specimen caption="default">
      <Field v-slot="{ control }" label="Refresh rate" hint="Seconds between two polls.">
        <NumberInput v-model="rate" v-bind="control" />
      </Field>
    </Specimen>
    <Specimen caption="error">
      <Field v-slot="{ control }" label="Refresh rate" hint="Seconds between two polls." error="The shortest refresh rate is 60 seconds.">
        <NumberInput v-model="tooShort" v-bind="control" />
      </Field>
    </Specimen>
    <Specimen caption="optional">
      <Field v-slot="{ control }" label="Label" optional hint="Without one the file's name is used.">
        <TextInput v-model="label" v-bind="control" prose />
      </Field>
    </Specimen>
    <Specimen caption="around a textarea">
      <Field v-slot="{ control }" class="roomy" label="HTML" hint="Drawn at the Device's size.">
        <Textarea v-model="html" v-bind="control" spellcheck="false" />
      </Field>
    </Specimen>
  </SpecimenRow>
</template>

<style scoped>
@layer components {
  .roomy {
    width: 22rem;
    max-width: 100%;
  }
}
</style>
