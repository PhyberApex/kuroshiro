<script setup lang="ts">
import type { Appearance } from './appearance'
import type { Segment } from '@/components/SegmentedFilter.vue'
import SegmentedFilter from '@/components/SegmentedFilter.vue'
import { useInstanceFacts } from '@/reads/sharedReads'
import { useAppearance } from './appearance'

const APPEARANCE_SEGMENTS: Segment<Appearance>[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

const appearance = useAppearance()
const instanceFacts = useInstanceFacts()
</script>

<template>
  <div class="instance-foot">
    <SegmentedFilter v-model="appearance" :segments="APPEARANCE_SEGMENTS" aria-label="Appearance" />
    <p v-if="instanceFacts.data">
      Kuroshiro <span class="version">{{ instanceFacts.data.version }}</span>
    </p>
  </div>
</template>

<style scoped>
@layer components {
  .instance-foot {
    display: grid;
    justify-items: start;
    gap: var(--space-3);
    padding-top: var(--space-4);
    border-top: var(--rule);
    color: var(--color-ink-soft);
    font-size: var(--text-sm);
  }

  .version {
    font-family: var(--font-mono);
  }
}
</style>
