<script setup lang="ts">
import type { RowMenuItem } from './rowMenuItem'
import RouteStage from '@/gallery/RouteStage.vue'
import Specimen from '@/gallery/Specimen.vue'
import SpecimenRow from '@/gallery/SpecimenRow.vue'
import RowMenu from './RowMenu.vue'

// An open menu hides the rest of the page from assistive technology and holds the focus, so it is shown closed here; RowMenu.shots.ts holds its open states.
const items: RowMenuItem[] = [
  { label: 'Open', to: '/plugins/weather' },
  { label: 'Duplicate', select: () => {} },
  { label: 'Export', select: () => {}, disabled: true },
  { label: 'Delete Plugin', select: () => {}, ruleAbove: true },
]
</script>

<template>
  <SpecimenRow>
    <RouteStage at="/plugins">
      <Specimen caption="closed; press it to open the menu">
        <RowMenu label="More actions for Weather" :items="items" />
      </Specimen>
      <Specimen caption="hover">
        <RowMenu label="More actions for Weather" :items="items" data-force="hover" />
      </Specimen>
      <Specimen caption="focus">
        <RowMenu label="More actions for Weather" :items="items" data-force="focus" />
      </Specimen>
      <Specimen caption="disabled">
        <RowMenu label="More actions for Weather" :items="items" disabled />
      </Specimen>
    </RouteStage>
  </SpecimenRow>
</template>
