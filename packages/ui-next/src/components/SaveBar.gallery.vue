<script setup lang="ts">
import Specimen from '@/gallery/Specimen.vue'
import SpecimenRow from '@/gallery/SpecimenRow.vue'
import SaveBar from './SaveBar.vue'
</script>

<template>
  <SpecimenRow>
    <Specimen caption="hidden: nothing has changed" wide>
      <div class="page">
        <SaveBar :changed="false" save-label="Save Plugin" cancel-label="Discard changes" />
      </div>
    </Specimen>
    <Specimen caption="unsaved" wide>
      <div class="page">
        <SaveBar changed save-label="Save Plugin" cancel-label="Discard changes">
          to the template and Data Sources. The preview already shows them.
        </SaveBar>
      </div>
    </Specimen>
    <Specimen caption="saving" wide>
      <div class="page">
        <SaveBar changed saving save-label="Save Plugin" cancel-label="Discard changes">
          to the template and Data Sources. The preview already shows them.
        </SaveBar>
      </div>
    </Specimen>
    <Specimen caption="invalid" wide>
      <div class="page">
        <SaveBar changed invalid="2 things to fix before this can be saved." save-label="Save Plugin" cancel-label="Discard changes" />
      </div>
    </Specimen>
    <Specimen caption="not saved" wide>
      <div class="page">
        <SaveBar changed failed reason="Kuroshiro's server is not answering." save-label="Save Plugin" cancel-label="Discard changes" />
      </div>
    </Specimen>
  </SpecimenRow>
</template>

<style scoped>
@layer components {
  /* Each bar gets a page of its own to stick to: in the gallery it stays inside its specimen. */
  .page {
    justify-self: stretch;
  }

  .page :deep(.save-bar) {
    margin-top: 0;
  }
}
</style>
