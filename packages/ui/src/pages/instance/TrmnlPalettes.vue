<script setup lang="ts">
import type { PaletteRead } from 'kuroshiro-shared'
import TuckedSection from '@/components/TuckedSection.vue'
import PaletteRow from './PaletteRow.vue'

defineProps<{
  /** The Palettes synced from TRMNL, as the server orders them. */
  palettes: PaletteRead[]
}>()
</script>

<template>
  <TuckedSection id="trmnl-palettes" :title="`TRMNL's Palettes (${palettes.length})`" heading="h3">
    <p class="synced">
      Synced from TRMNL and not editable. Each Device Model lists the ones it supports.
    </p>
    <ul class="rows">
      <PaletteRow v-for="palette in palettes" :key="palette.id" :palette="palette" />
    </ul>
  </TuckedSection>
</template>

<style scoped>
@layer components {
  .synced {
    max-width: var(--measure);
    color: var(--color-ink-soft);
    text-wrap: pretty;
  }

  .rows {
    margin-top: var(--space-3);
    border-top: var(--rule);
  }
}
</style>
