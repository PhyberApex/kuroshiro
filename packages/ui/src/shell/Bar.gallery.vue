<script setup lang="ts">
import RouteStage from '@/gallery/RouteStage.vue'
import Specimen from '@/gallery/Specimen.vue'
import SpecimenRow from '@/gallery/SpecimenRow.vue'
import Bar from './Bar.vue'

const three = [
  { id: 'hallway', name: 'Hallway' },
  { id: 'kitchen', name: 'Kitchen' },
  { id: 'study', name: 'Study' },
]
const five = [...three, { id: 'attic', name: 'Attic' }, { id: 'porch', name: 'Porch' }]
const long = [{ id: 'kitchen', name: 'Kitchen by the window' }]
</script>

<template>
  <SpecimenRow>
    <Specimen caption="current, default" wide>
      <RouteStage at="/devices/kitchen/settings">
        <Bar class="bar" :devices="three" />
      </RouteStage>
    </Specimen>
    <Specimen caption="an Alert firing" wide>
      <RouteStage at="/plugins">
        <Bar class="bar" :devices="three" :firing-alerts="2" />
      </RouteStage>
    </Specimen>
    <Specimen caption="on the Alerts page" wide>
      <RouteStage at="/alerts">
        <Bar class="bar" :devices="three" :firing-alerts="1" />
      </RouteStage>
    </Specimen>
  </SpecimenRow>
  <SpecimenRow title="The Devices">
    <Specimen caption="no Devices" wide>
      <RouteStage at="/connect">
        <Bar class="bar" :devices="[]" />
      </RouteStage>
    </Specimen>
    <Specimen caption="a name over 16 characters, with its tooltip" wide>
      <RouteStage at="/instance/settings">
        <Bar class="bar" :devices="long" tooltip-open-on="Kitchen by the w…" />
      </RouteStage>
    </Specimen>
    <Specimen caption="five Devices or more, or names that do not fit" wide>
      <RouteStage at="/devices/attic">
        <Bar class="bar" :devices="five" />
      </RouteStage>
    </Specimen>
  </SpecimenRow>
</template>

<style scoped>
@layer components {
  .bar {
    width: 100%;
  }
}
</style>
