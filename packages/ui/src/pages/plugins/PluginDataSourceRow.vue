<script setup lang="ts">
import type { DataSourceRead } from 'kuroshiro-shared'
import type { DataSourceDraft } from './pluginDataSources'
import { computed } from 'vue'
import Button from '@/components/Button.vue'
import DataSourceRow from '@/components/DataSourceRow.vue'
import DataSourceForm from './DataSourceForm.vue'
import DataSourceHealth from './DataSourceHealth.vue'
import DataSourceStory from './DataSourceStory.vue'
import { dataSourceName, fetchStanding, whatItIs } from './pluginDataSourceWording'

/** One Data Source of the Plugin's form as a row: its name, what it is and its health, and opened, its form beside the story of its fetches. */
const props = defineProps<{
  /** The path a save sends the Data Source at: `dataSources.2`. A removed one is not sent and has none. */
  path?: string
  /** The form's problems, by path. */
  errors: Record<string, string>
  /** What the server says of its fetches; a Data Source that was added and not saved has none. */
  facts?: DataSourceRead
  pluginName: string
}>()

defineEmits<{
  remove: []
}>()

const source = defineModel<DataSourceDraft>('source', { required: true })

const name = computed(() => dataSourceName(source.value))
const standing = computed(() => fetchStanding(source.value, props.facts))
</script>

<template>
  <DataSourceRow :value="source.key" :name="name" :what="whatItIs(source)" :removed="source.removed">
    <template #health>
      <template v-if="source.removed">
        Removed when you save ·
        <Button variant="quiet" class="put-back" :aria-label="`Put back ${name}`" @click="source.removed = false">
          Put back
        </Button>
      </template>
      <DataSourceHealth v-else :standing="standing" :facts="facts" />
    </template>
    <div v-if="path" class="opened">
      <DataSourceForm v-model:source="source" :path="path" :errors="errors" />
      <DataSourceStory :standing="standing" :facts="facts" :name="name" :plugin-name="pluginName" @remove="$emit('remove')" />
    </div>
  </DataSourceRow>
</template>

<style scoped>
@layer components {
  .opened {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 18rem);
    align-items: start;
    gap: var(--space-5) var(--space-10);
  }

  /* In the row's line a button is as high as the line of text it stands in. */
  .put-back {
    min-height: 0;
  }

  @media (max-width: 820px) {
    .opened {
      grid-template-columns: minmax(0, 1fr);
    }
  }
}
</style>
