<script setup lang="ts">
import type { PickableLayout } from './LayoutPicker.vue'
import { ref } from 'vue'
import Specimen from '@/gallery/Specimen.vue'
import SpecimenRow from '@/gallery/SpecimenRow.vue'
import LayoutPicker from './LayoutPicker.vue'

const layouts: PickableLayout[] = [
  { id: '1Lx1R', name: 'Left and right', slotCount: 2 },
  { id: '1Tx1B', name: 'Top and bottom', slotCount: 2 },
  { id: '1Lx2R', name: 'One left, two right', slotCount: 3 },
  { id: '2Lx1R', name: 'Two left, one right', slotCount: 3 },
  { id: '2Tx1B', name: 'Two top, one bottom', slotCount: 3 },
  { id: '1Tx2B', name: 'One top, two bottom', slotCount: 3 },
  { id: '2x2', name: 'Four quarters', slotCount: 4 },
]

const chosen = ref('1Lx1R')
</script>

<template>
  <SpecimenRow>
    <Specimen caption="checked Left and right, hover Top and bottom, focus One left, two right, the rest default" wide>
      <LayoutPicker
        v-model="chosen"
        class="picker"
        :layouts="layouts"
        aria-label="Layout"
        :force="{ '1Tx1B': 'hover', '1Lx2R': 'focus' }"
      />
    </Specimen>
  </SpecimenRow>
</template>

<style scoped>
@layer components {
  .picker {
    width: 100%;
  }
}
</style>
