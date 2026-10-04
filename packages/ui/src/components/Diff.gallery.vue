<script setup lang="ts">
import Specimen from '@/gallery/Specimen.vue'
import SpecimenRow from '@/gallery/SpecimenRow.vue'
import Diff from './Diff.vue'

const before = [
  '<div class="layout layout--col">',
  '  <div class="item">',
  '    <span class="value value--xxxlarge">{{ forecast.current.temperature | round }}°</span>',
  '    <span class="label">{{ forecast.current.summary }}</span>',
  '  </div>',
  '  <div class="columns">',
  '    {% for hour in forecast.hourly limit: 4 %}',
  '      <div class="column">',
  '        <span class="value">{{ hour.temperature | round }}</span>',
  '        <span class="label">{{ hour.time }}</span>',
  '      </div>',
  '    {% endfor %}',
  '  </div>',
  '</div>',
]

const after = [
  ...before.slice(0, 2),
  '    <span class="value value--xxxlarge">{{ forecast.current.temperature | round }}{{ unit_sign }}</span>',
  ...before.slice(3, 13),
  '  <span class="label label--small">Feels like {{ forecast.current.feels_like | round }}{{ unit_sign }}</span>',
  '</div>',
]

const source = ['method: GET', 'url: https://api.open-meteo.example/v1/forecast?q={{ location }}&units={{ units }}']
</script>

<template>
  <SpecimenRow title="Lines">
    <Specimen caption="unchanged, removed and added lines, and a folded run: press it to show the lines" wide>
      <Diff class="stretch" :before="before" :after="after" label="The Recipe's change to Template full" />
    </Specimen>
    <Specimen caption="a one-line value" wide>
      <Diff class="stretch" :before="['every 15 minutes']" :after="['every 30 minutes']" label="The Recipe's change to the refresh interval" />
    </Specimen>
    <Specimen caption="added whole" wide>
      <Diff class="stretch" :before="[]" :after="before.slice(0, 5)" label="The Recipe's Template quadrant" />
    </Specimen>
    <Specimen caption="a value shown whole, not folded" wide>
      <Diff class="stretch" :before="source" :after="source" label="Your Data Source forecast" :fold="false" />
    </Specimen>
  </SpecimenRow>
</template>

<style scoped>
@layer components {
  .stretch {
    justify-self: stretch;
    min-width: 0;
  }
}
</style>
