<script setup lang="ts">
import type { PaletteRead } from 'kuroshiro-shared'
import { computed } from 'vue'
import { customPalettesByName } from './deviceModelsWording'
import InstanceSection from './InstanceSection.vue'
import PaletteRow from './PaletteRow.vue'

const props = defineProps<{
  palettes: PaletteRead[]
}>()

const custom = computed(() => customPalettesByName(props.palettes))
</script>

<template>
  <InstanceSection id="custom-palettes" title="Custom Palettes">
    <!-- #aside: "Add a custom Palette", and its form between the heading and the rows (#1175) -->
    <ul v-if="custom.length > 0">
      <!-- A row's "Edit" and "Delete" stand after its Devices, and its form opens in LibraryRow's #form (#1175) -->
      <PaletteRow v-for="palette in custom" :key="palette.id" :palette="palette" />
    </ul>
    <p v-else class="none">
      None yet. A colour panel rarely shows the exact red or yellow TRMNL's Palette assumes. A custom Palette holds the colours your panel really shows, so images are reduced to those.
    </p>
  </InstanceSection>
</template>

<style scoped>
@layer components {
  .none {
    max-width: var(--measure);
    margin-top: var(--space-3);
    color: var(--color-ink-soft);
    text-wrap: pretty;
  }
}
</style>
