<script setup lang="ts">
import { ref } from 'vue'
import Specimen from '@/gallery/Specimen.vue'
import SpecimenRow from '@/gallery/SpecimenRow.vue'
import SaveState from './SaveState.vue'
import Textarea from './Textarea.vue'

const html = ref('<div class="note">\n  Back at 6\n</div>')
const empty = ref('')
</script>

<template>
  <SpecimenRow>
    <Specimen caption="default">
      <div class="sized">
        <Textarea v-model="html" aria-label="HTML" spellcheck="false" />
      </div>
    </Specimen>
    <Specimen caption="empty">
      <div class="sized">
        <Textarea v-model="empty" aria-label="HTML" placeholder="<div>…</div>" spellcheck="false" />
      </div>
    </Specimen>
    <Specimen caption="hover">
      <div class="sized">
        <Textarea v-model="html" aria-label="HTML" spellcheck="false" data-force="hover" />
      </div>
    </Specimen>
    <Specimen caption="focus">
      <div class="sized">
        <Textarea v-model="html" aria-label="HTML" spellcheck="false" data-force="focus" />
      </div>
    </Specimen>
    <Specimen caption="disabled">
      <div class="sized">
        <Textarea v-model="html" aria-label="HTML" spellcheck="false" disabled />
      </div>
    </Specimen>
    <Specimen caption="invalid">
      <div class="sized">
        <Textarea v-model="empty" aria-label="HTML" spellcheck="false" invalid />
      </div>
    </Specimen>
    <Specimen caption="with the place of the save state">
      <div class="sized">
        <Textarea v-model="html" aria-label="HTML" spellcheck="false">
          <template #status>
            <SaveState status="saved" />
          </template>
        </Textarea>
      </div>
    </Specimen>
  </SpecimenRow>
</template>

<style scoped>
@layer components {
  .sized {
    width: 20rem;
    max-width: 100%;
  }
}
</style>
