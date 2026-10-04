<script setup lang="ts">
import type { DataSourceRead } from 'kuroshiro-shared'
import type { FetchStanding } from './pluginDataSourceWording'
import Button from '@/components/Button.vue'
import RelativeTime from '@/patterns/RelativeTime.vue'
import DataSourceFailing from './DataSourceFailing.vue'

/** How an opened Data Source is doing, beside its form, with the button that removes it. */
defineProps<{
  standing: FetchStanding
  /** What the server says of its fetches; a Data Source that was added and not saved has none. */
  facts?: DataSourceRead
  /** The name the template reads the Data Source by, as it is entered. */
  name: string
  pluginName: string
}>()

defineEmits<{
  remove: []
}>()
</script>

<template>
  <div class="side">
    <div class="story">
      <p v-if="standing === 'literal'">
        A fixed value. Nothing is fetched, so it has no Fetch Failure Streak.
      </p>
      <DataSourceFailing v-else-if="standing === 'failing' && facts" :facts="facts" :name="name" :plugin-name="pluginName" />
      <p v-else-if="standing === 'fetched' && facts?.lastFetchSucceededAt">
        Fetched <RelativeTime :at="facts.lastFetchSucceededAt" />, at the last scheduled render.
      </p>
      <p v-else>
        Not fetched yet. The first scheduled render fetches it.
      </p>
    </div>
    <Button @click="$emit('remove')">
      Remove Data Source
    </Button>
  </div>
</template>

<style scoped>
@layer components {
  .side {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    align-content: start;
    justify-items: start;
    gap: var(--space-4);
    min-width: 0;
  }

  /* One column that may shrink, so a long error scrolls in its block and does not widen the story. */
  .story {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    justify-self: stretch;
    gap: var(--space-3);
    min-width: 0;
    color: var(--color-ink-soft);
    text-wrap: pretty;
  }

  .story :deep(code) {
    color: var(--color-ink);
    font-family: var(--font-mono);
    font-size: 0.92em;
  }
}
</style>
