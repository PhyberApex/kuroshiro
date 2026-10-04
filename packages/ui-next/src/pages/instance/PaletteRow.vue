<script setup lang="ts">
import type { PaletteRead } from 'kuroshiro-shared'
import { computed } from 'vue'
import LibraryRow from '@/components/LibraryRow.vue'
import Swatches from '@/components/Swatches.vue'
import { swatchColours } from './deviceModelsWording'
import DeviceNames from './DeviceNames.vue'
import { paletteFamilyName } from './paletteFamilies'

const props = defineProps<{
  palette: PaletteRead
}>()

/** A custom Palette is told by its Palette Family in words; one of TRMNL's by the id TRMNL gave it. */
const family = computed(() => props.palette.kind === 'custom' ? paletteFamilyName(props.palette.frameworkClass) : undefined)
</script>

<template>
  <LibraryRow :name="palette.name">
    <p class="colours">
      <Swatches :colours="swatchColours(palette)" />
      <span v-if="family">{{ family }}</span>
      <span v-else class="id">{{ palette.kind === 'custom' ? palette.frameworkClass : palette.id }}</span>
    </p>
    <template v-if="palette.usedBy.length > 0" #end>
      <span><DeviceNames :devices="palette.usedBy" section="display" /></span>
    </template>
  </LibraryRow>
</template>

<style scoped>
@layer components {
  .colours {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-1) var(--space-2);
  }

  .id {
    font-family: var(--font-mono);
  }
}
</style>
