<script setup lang="ts">
import { ref } from 'vue'
import { screenDocument } from '@/gallery/editorSamples'
import Specimen from '@/gallery/Specimen.vue'
import SpecimenRow from '@/gallery/SpecimenRow.vue'
import Button from './Button.vue'
import PreviewPlate from './PreviewPlate.vue'

const landscape = screenDocument(800, 480)
const large = screenDocument(1872, 1404)

const redrawn = ref(landscape)
const drawAnother = () => redrawn.value = redrawn.value === landscape ? screenDocument(480, 800) : landscape
</script>

<template>
  <SpecimenRow title="Drawn: the document at the Device Model's pixels, scaled to the plate">
    <Specimen caption="800 × 480">
      <div class="place">
        <PreviewPlate name="Preview of Weather" :document="landscape" :width="800" :height="480" />
      </div>
    </Specimen>
    <Specimen caption="1872 × 1404, at the same width">
      <div class="place">
        <PreviewPlate name="Preview of Weather on TRMNL X" :document="large" :width="1872" :height="1404" />
      </div>
    </Specimen>
    <Specimen caption="redrawing: the old drawing stays until the new one has loaded">
      <div class="place">
        <PreviewPlate name="Preview of Calendar" :document="redrawn" :width="800" :height="480" />
        <Button class="again" @click="drawAnother">
          Draw another
        </Button>
      </div>
    </Specimen>
  </SpecimenRow>
  <SpecimenRow title="Not drawn, and rendering">
    <Specimen caption="not drawn: the last drawing at 40%">
      <div class="place">
        <PreviewPlate name="Preview of Train departures" :document="landscape" :width="800" :height="480" not-drawn />
      </div>
    </Specimen>
    <Specimen caption="not drawn, with no earlier drawing">
      <div class="place">
        <PreviewPlate name="Preview of Sourdough timer" :document="null" :width="800" :height="480" not-drawn />
      </div>
    </Specimen>
    <Specimen caption="rendering">
      <div class="place">
        <PreviewPlate name="Preview of Doorbell note" :document="null" :width="800" :height="480" rendering />
      </div>
    </Specimen>
    <Specimen caption="rendering, with a note">
      <div class="place">
        <PreviewPlate name="Preview of Air quality" :document="null" :width="800" :height="480" rendering rendering-note="Fetching the data" />
      </div>
    </Specimen>
  </SpecimenRow>
</template>

<style scoped>
@layer components {
  .place {
    width: min(19rem, 100vw - 3rem);
    padding: 2px;
  }

  .again {
    margin-top: var(--space-3);
  }
}
</style>
