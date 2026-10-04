<script setup lang="ts">
import Specimen from '@/gallery/Specimen.vue'
import SpecimenRow from '@/gallery/SpecimenRow.vue'
import SummaryList from './SummaryList.vue'
import SummaryRow from './SummaryRow.vue'

const TO_MIND = [
  'Hallway\'s API key was redacted. Hallway gets a new one and has to be set up again.',
  'Firmware 2.0.3 comes without its file. Upload it again before pushing it.',
]
</script>

<template>
  <SpecimenRow>
    <Specimen caption="labels and values, the last one a list of problems" wide>
      <SummaryList class="stretch">
        <SummaryRow label="Archive">
          <span class="file">kuroshiro-config-2026-09-28.zip</span>
          <p>A Redacted Archive from Kuroshiro 0.17.1, exported 28 Sept 2026, 21:14.</p>
        </SummaryRow>
        <SummaryRow label="Adds">
          1 Device (Hallway), 4 Plugins, 9 Screens with their Schedules, 1 Mashup, 1 custom Palette, 1 custom Firmware
        </SummaryRow>
        <SummaryRow label="Replaces">
          The Instance Settings, with the 2 the archive holds. The others go back to their fallback.
        </SummaryRow>
        <SummaryRow label="Mind" :problems="TO_MIND" />
      </SummaryList>
    </Specimen>
  </SpecimenRow>
</template>

<style scoped>
@layer components {
  .stretch {
    width: 100%;
  }

  .file {
    font-family: var(--font-mono);
    font-size: var(--text-sm);
  }
}
</style>
