<script setup lang="ts">
import type { DeviceLogLevelFilter } from 'kuroshiro-shared'
import type { Segment } from '@/components/SegmentedFilter.vue'
import Button from '@/components/Button.vue'
import SearchField from '@/components/SearchField.vue'
import SegmentedFilter from '@/components/SegmentedFilter.vue'

defineProps<{
  /** Whether the Device Log holds anything to clear. */
  clearable: boolean
}>()

defineEmits<{
  clear: []
}>()

const level = defineModel<DeviceLogLevelFilter>('level', { required: true })
/** What stands in the search field, as it is typed. */
const search = defineModel<string>('search', { required: true })

const LEVELS: Segment<DeviceLogLevelFilter>[] = [
  { value: 'all', label: 'All' },
  { value: 'problems', label: 'Warnings and errors' },
]
</script>

<template>
  <div class="log-bar">
    <SegmentedFilter v-model="level" :segments="LEVELS" aria-label="Level" />
    <div class="search">
      <SearchField v-model="search" aria-label="Search messages" placeholder="Search messages" />
    </div>
    <Button class="clear" :disabled="!clearable" @click="$emit('clear')">
      Clear Logs
    </Button>
  </div>
</template>

<style scoped>
@layer components {
  .log-bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-3);
    margin-top: var(--space-8);
  }

  .search {
    flex: 1 1 14rem;
    max-width: 22rem;
  }

  .clear {
    margin-left: auto;
  }

  @media (max-width: 820px) {
    .log-bar {
      margin-top: var(--space-6);
    }

    .search {
      max-width: none;
    }

    .clear {
      margin-left: 0;
    }
  }
}
</style>
