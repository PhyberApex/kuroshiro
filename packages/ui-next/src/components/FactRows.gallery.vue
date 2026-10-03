<script setup lang="ts">
import type { Fact } from './fact'
import RouteStage from '@/gallery/RouteStage.vue'
import Specimen from '@/gallery/Specimen.vue'
import SpecimenRow from '@/gallery/SpecimenRow.vue'
import FactRows from './FactRows.vue'

const facts: Fact[] = [
  { label: 'Last seen', value: '4 min ago' },
  { label: 'Battery', value: '18 %', alert: 'Alert: battery low' },
  { label: 'Signal', value: '−61 dBm' },
  { label: 'Sleep Mode', value: '23:00–06:00' },
  { label: 'Temperature', value: null },
  { label: 'Device Model', value: 'reports another size', to: '/devices/kitchen/settings' },
  { label: 'Special Function', value: 'Reboot at the next poll', pending: true },
]

const offline: Fact[] = [
  { label: 'Last seen', value: 'last seen 3 h ago', alert: 'Alert: offline' },
  { label: 'Battery', value: '76 %' },
  { label: 'Firmware', value: '1.7.4 at the next poll', pending: true },
]
</script>

<template>
  <SpecimenRow>
    <Specimen caption="default, firing Alert, a link, pending; the fact without a value is left out">
      <RouteStage at="/devices/kitchen">
        <FactRows class="column" :facts="facts" />
      </RouteStage>
    </Specimen>
    <Specimen caption="the offline Alert, pending">
      <FactRows class="column" :facts="offline" />
    </Specimen>
  </SpecimenRow>
</template>

<style scoped>
@layer components {
  .column {
    width: min(18.5rem, 100%);
  }
}
</style>
