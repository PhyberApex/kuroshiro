<script setup lang="ts">
import type { NavItem } from './navItem'
import RouteStage from '@/gallery/RouteStage.vue'
import Specimen from '@/gallery/Specimen.vue'
import SpecimenRow from '@/gallery/SpecimenRow.vue'
import Tabs from './Tabs.vue'

const views: NavItem[] = [
  { label: 'Screens', to: '/devices/kitchen' },
  { label: 'Settings', to: '/devices/kitchen/settings' },
  { label: 'Logs', to: '/devices/kitchen/logs' },
  { label: 'Default', to: '/devices/kitchen/default' },
]
</script>

<template>
  <SpecimenRow>
    <Specimen caption="current, hover, focus, default" wide>
      <RouteStage at="/devices/kitchen">
        <Tabs class="tabs" label="Kitchen" :items="views" :force="{ Settings: 'hover', Logs: 'focus' }" />
      </RouteStage>
    </Specimen>
  </SpecimenRow>
</template>

<style scoped>
@layer components {
  .tabs {
    width: 100%;
  }
}
</style>
