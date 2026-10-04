<script setup lang="ts">
import type { NavItem } from './navItem'
import RouteStage from '@/gallery/RouteStage.vue'
import Specimen from '@/gallery/Specimen.vue'
import SpecimenRow from '@/gallery/SpecimenRow.vue'
import PageList from './PageList.vue'

const pages: NavItem[] = [
  { label: 'Instance Settings', to: '/instance/settings' },
  { label: 'Firmware', to: '/instance/firmware' },
  { label: 'Device Models and Palettes', to: '/instance/models' },
  { label: 'Configuration Archive', to: '/instance/archive' },
  { label: 'Housekeeping', to: '/instance/housekeeping' },
  { label: 'Device Simulator', to: '/instance/simulator' },
]
</script>

<template>
  <SpecimenRow>
    <Specimen caption="current, hover, focus, the rest default. Below 820 px it is one row that scrolls sideways" wide>
      <RouteStage at="/instance/settings">
        <PageList
          class="list"
          label="Instance"
          :items="pages"
          :force="{ 'Firmware': 'hover', 'Device Models and Palettes': 'focus' }"
        />
      </RouteStage>
    </Specimen>
  </SpecimenRow>
</template>

<style scoped>
@layer components {
  .list {
    width: 13.5rem;
    max-width: 100%;
    margin-left: var(--space-2);
  }
}
</style>
