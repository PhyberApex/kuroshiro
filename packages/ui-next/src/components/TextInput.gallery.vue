<script setup lang="ts">
import { ref } from 'vue'
import Specimen from '@/gallery/Specimen.vue'
import SpecimenRow from '@/gallery/SpecimenRow.vue'
import TextInput from './TextInput.vue'

const name = ref('Kitchen')
const link = ref('')
const saved = ref('Hallway')
</script>

<template>
  <SpecimenRow>
    <Specimen caption="default">
      <TextInput v-model="name" aria-label="Name" />
    </Specimen>
    <Specimen caption="empty">
      <TextInput v-model="link" type="url" placeholder="https://" aria-label="Link" />
    </Specimen>
    <Specimen caption="hover">
      <TextInput v-model="name" aria-label="Name" data-force="hover" />
    </Specimen>
    <Specimen caption="focus">
      <TextInput v-model="name" aria-label="Name" data-force="focus" />
    </Specimen>
    <Specimen caption="disabled">
      <TextInput v-model="name" aria-label="Name" disabled />
    </Specimen>
    <Specimen caption="invalid">
      <TextInput v-model="link" placeholder="https://" aria-label="Link" invalid />
    </Specimen>
    <Specimen caption="in the text face">
      <TextInput v-model="name" aria-label="Name" prose />
    </Specimen>
  </SpecimenRow>

  <SpecimenRow title="With the place of the save state">
    <Specimen caption="the state itself comes with save as changed">
      <TextInput v-model="saved" aria-label="Name">
        <template #status>
          <span class="state">Saved</span>
        </template>
      </TextInput>
    </Specimen>
    <Specimen caption="wide" wide>
      <div class="stretch">
        <TextInput v-model="saved" aria-label="Name" wide>
          <template #status>
            <span class="state">Saved</span>
          </template>
        </TextInput>
      </div>
    </Specimen>
  </SpecimenRow>
</template>

<style scoped>
@layer components {
  .stretch {
    justify-self: stretch;
  }

  .state {
    color: var(--color-ink-soft);
    font-size: var(--text-sm);
  }
}
</style>
