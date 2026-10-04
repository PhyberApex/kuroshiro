<script setup lang="ts">
import type { Segment } from '@/components/SegmentedFilter.vue'
import SearchField from '@/components/SearchField.vue'
import SegmentedFilter from '@/components/SegmentedFilter.vue'

export type Show = 'all' | 'problems'

defineProps<{
  /** The list is long enough to be searched. */
  searchable: boolean
  /** A Plugin has a problem, so there is something to filter by. */
  filterable: boolean
}>()

const query = defineModel<string>('query', { required: true })
const show = defineModel<Show>('show', { required: true })

const SHOW_SEGMENTS: Segment<Show>[] = [
  { value: 'all', label: 'All' },
  { value: 'problems', label: 'With a problem' },
]
</script>

<template>
  <div v-if="searchable || filterable" class="filter-bar">
    <div v-if="searchable" class="search">
      <SearchField v-model="query" aria-label="Find a Plugin" placeholder="Find a Plugin" />
    </div>
    <SegmentedFilter v-if="filterable" v-model="show" :segments="SHOW_SEGMENTS" aria-label="Show" />
  </div>
</template>

<style scoped>
@layer components {
  .filter-bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-3);
    margin-bottom: var(--space-4);
  }

  .search {
    flex: 1 1 14rem;
    max-width: 22rem;
  }
}
</style>
