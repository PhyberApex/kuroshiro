<script setup lang="ts">
import type { DeviceModelRead, PaletteRead } from 'kuroshiro-shared'
import { computed } from 'vue'
import LibraryRow from '@/components/LibraryRow.vue'
import { paletteNames, panelSize } from './deviceModelsWording'
import DeviceNames from './DeviceNames.vue'

const props = defineProps<{
  model: DeviceModelRead
  palettes: PaletteRead[]
}>()

const NO_LONGER_LISTED = 'TRMNL no longer lists this Device Model.'

const supported = computed(() => paletteNames(props.model, props.palettes))
</script>

<template>
  <LibraryRow :name="model.label" :problem="model.deprecated ? NO_LONGER_LISTED : undefined">
    <p>
      <span class="size">{{ panelSize(model) }}</span>
      <template v-if="supported">
        {{ ' · ' }}{{ supported }}
      </template>
    </p>
    <template v-if="model.usedBy.length > 0" #end>
      <span><DeviceNames :devices="model.usedBy" section="display" /></span>
    </template>
  </LibraryRow>
</template>

<style scoped>
@layer components {
  .size {
    font-family: var(--font-mono);
  }
}
</style>
