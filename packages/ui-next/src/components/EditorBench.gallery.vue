<script setup lang="ts">
import { ref } from 'vue'
import { KUROSHIRO_FILTER_NAMES, screenDocument, WEATHER_DATA, WEATHER_TEMPLATE } from '@/gallery/editorSamples'
import Specimen from '@/gallery/Specimen.vue'
import SpecimenRow from '@/gallery/SpecimenRow.vue'
import CodeEditor from './CodeEditor.vue'
import EditorBench from './EditorBench.vue'
import PreviewPlate from './PreviewPlate.vue'

const onThePage = ref(WEATHER_TEMPLATE)
const inTheWindow = ref(WEATHER_TEMPLATE)
const drawing = screenDocument(800, 480)

const underThePlate = [
  { kind: 'facts', text: 'TRMNL OG (2-bit) · 800 × 480 · 4 Grays (2-bit)' },
  { kind: 'honest', text: 'Your browser draws this. Kitchen shows it in 4 grays.' },
]
const scrolling = { kind: 'honest', text: 'What stands under the plate scrolls with it, and the editor stays where it is.' }
</script>

<template>
  <SpecimenRow title="On the page: the editor 6 parts of 11, stacked below 820 px">
    <Specimen caption="the editor, the plate and what sits under it" wide>
      <EditorBench class="stretch">
        <template #editor>
          <CodeEditor
            v-model="onThePage"
            mode="liquid"
            :completion-data="WEATHER_DATA"
            :kuroshiro-filters="KUROSHIRO_FILTER_NAMES"
            aria-label="Template of Weather on the bench"
          />
        </template>
        <template #plate>
          <div class="plate-place">
            <PreviewPlate name="Preview of Weather on the bench" :document="drawing" :width="800" :height="480" />
          </div>
        </template>
        <p v-for="line in underThePlate" :key="line.text" :class="line.kind">
          {{ line.text }}
        </p>
      </EditorBench>
    </Specimen>
  </SpecimenRow>
  <SpecimenRow title="In the full window: the editor fills the height, the preview column is 40% and scrolls by itself">
    <Specimen caption="in a place 22 rem high" wide>
      <div class="window stretch">
        <EditorBench full-window>
          <template #editor>
            <CodeEditor v-model="inTheWindow" mode="liquid" size="full-window" aria-label="Template of Weather in the full window" />
          </template>
          <template #plate>
            <div class="plate-place narrow">
              <PreviewPlate name="Preview of Weather in the full window" :document="drawing" :width="800" :height="480" />
            </div>
          </template>
          <p v-for="line in [...underThePlate, scrolling]" :key="line.text" :class="line.kind">
            {{ line.text }}
          </p>
        </EditorBench>
      </div>
    </Specimen>
  </SpecimenRow>
</template>

<style scoped>
@layer components {
  .stretch {
    justify-self: stretch;
    min-width: 0;
  }

  .window {
    height: 22rem;
  }

  /*
  Widths that make the 800 by 480 plate a whole number of pixels high. The edge of a scaled frame that lands on a
  fraction of a pixel is antialiased differently from one run to the next, which no screenshot baseline survives.
  */
  .plate-place {
    width: 25rem;
  }

  .plate-place.narrow {
    width: 22.5rem;
  }

  @media (max-width: 820px) {
    .window {
      height: auto;
    }

    .plate-place,
    .plate-place.narrow {
      width: 20.9375rem;
      max-width: 100%;
    }
  }

  .facts {
    margin-top: var(--space-3);
    color: var(--color-ink-soft);
    font-family: var(--font-mono);
    font-size: var(--text-xs);
  }

  .honest {
    margin-top: var(--space-2);
    color: var(--color-ink-soft);
    font-size: var(--text-sm);
  }
}
</style>
