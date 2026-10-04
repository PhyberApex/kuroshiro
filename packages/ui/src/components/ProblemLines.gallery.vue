<script setup lang="ts">
import type { ProblemLine } from './problemLine'
import RouteStage from '@/gallery/RouteStage.vue'
import Specimen from '@/gallery/Specimen.vue'
import SpecimenRow from '@/gallery/SpecimenRow.vue'
import ProblemLines from './ProblemLines.vue'

const lines: ProblemLine[] = [
  {
    kind: 'alert',
    text: 'Alert: the Data Source forecast keeps failing',
    link: { label: 'See the error', to: '/plugins/weather#data-sources' },
  },
  {
    kind: 'problem',
    text: 'The required Plugin Field City is empty. Weather renders without it.',
    link: { label: 'Fill in the Field Values', to: '/plugins/weather#field-values' },
  },
  {
    kind: 'problem',
    text: 'The template could not be rendered at 14:05: undefined filter "celsius"',
  },
]
</script>

<template>
  <SpecimenRow>
    <Specimen caption="an Alert line, a problem line, a problem line without a link" wide>
      <RouteStage at="/plugins/weather">
        <ProblemLines class="stretch" :lines="lines" />
      </RouteStage>
    </Specimen>
  </SpecimenRow>
</template>

<style scoped>
@layer components {
  .stretch {
    justify-self: stretch;
  }
}
</style>
