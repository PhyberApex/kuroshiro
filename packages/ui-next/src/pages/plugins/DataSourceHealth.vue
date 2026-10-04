<script setup lang="ts">
import type { DataSourceRead } from 'kuroshiro-shared'
import type { FetchStanding } from './pluginDataSourceWording'
import RelativeTime from '@/patterns/RelativeTime.vue'
import { fetchTrouble } from './pluginDataSourceWording'
import PluginRowStateCell from './PluginRowStateCell.vue'

/** A Data Source's health in its row. A literal one has none. */
defineProps<{
  standing: FetchStanding
  /** What the server says of its fetches; a Data Source that was added and not saved has none. */
  facts?: DataSourceRead
}>()
</script>

<template>
  <span v-if="standing === 'failing' && facts" class="trouble">
    <PluginRowStateCell :state="fetchTrouble(facts)" />
  </span>
  <template v-else-if="standing === 'fetched' && facts?.lastFetchSucceededAt">
    Fetched <RelativeTime :at="facts.lastFetchSucceededAt" />
  </template>
  <template v-else-if="standing === 'never'">
    Not fetched yet
  </template>
</template>

<style scoped>
@layer components {
  /* The mark and its words are a flex line of their own, which would otherwise sit on the mark's baseline. */
  .trouble {
    display: flex;
  }
}
</style>
