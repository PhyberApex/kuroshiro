<script setup lang="ts">
import type { DataSourceDraft } from './pluginDataSources'
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
import { useRoute } from 'vue-router'
import Button from '@/components/Button.vue'
import DataSourceRows from '@/components/DataSourceRows.vue'
import PageSection from '@/patterns/PageSection.vue'
import { useInstanceFacts } from '@/reads/sharedReads'
import PluginDataSourceRow from './PluginDataSourceRow.vue'
import { addedDataSource, dataSourcesPart, sentPaths } from './pluginDataSources'
import { fieldArrived, usePluginFormPart, usePluginPage } from './pluginPage'
import PluginRefreshInterval from './PluginRefreshInterval.vue'

const { plugin } = usePluginPage()
const instance = useInstanceFacts()
const route = useRoute()

/** The key of the opened row. */
const open = ref<string>()

const part = usePluginFormPart(dataSourcesPart(() => instance.data?.demoMode ?? false), reveal)

const paths = computed(() => sentPaths(part.draft.sources))
const factsById = computed(() => new Map(plugin.value.dataSources.map(source => [source.id, source])))
const factsOf = (row: DataSourceDraft) => row.id === null ? undefined : factsById.value.get(row.id)

const rowId = (key: string) => `data-source-${key}`

async function reveal(path: string) {
  const row = part.draft.sources[paths.value.findIndex(sent => sent !== undefined && path.startsWith(`${sent}.`))]
  if (!row)
    return
  open.value = row.key
  await fieldArrived(path)
}

const addButton = useTemplateRef('addButton')

async function add() {
  const row = addedDataSource(part.draft.sources)
  part.draft.sources.push(row)
  open.value = row.key
  const name = await fieldArrived(`${paths.value.at(-1)}.name`)
  name?.focus()
  if (name instanceof HTMLInputElement)
    name.select()
}

/** Removing is part of the unsaved form and asks nothing. A Data Source that was never saved has nothing to remove at a save, so it goes at once. */
async function remove(row: DataSourceDraft) {
  open.value = undefined
  if (row.id === null)
    part.draft.sources.splice(part.draft.sources.indexOf(row), 1)
  else
    row.removed = true
  await nextTick()
  const putBack = document.getElementById(rowId(row.key))?.querySelector<HTMLElement>('button:enabled')
  const next = putBack ?? addButton.value?.$el as HTMLElement | undefined
  next?.focus()
}

watch(() => route.query.source, async (name) => {
  const row = part.draft.sources.find(candidate => candidate.name === name && !candidate.removed)
  if (!row)
    return
  open.value = row.key
  await nextTick()
  document.getElementById(rowId(row.key))?.scrollIntoView()
}, { immediate: true })

/** A save gives an added row the key of its id: the row that was open stays open by its name. */
const openName = computed(() => part.draft.sources.find(row => row.key === open.value)?.name)
let lastOpenName: string | undefined
watch(openName, (name) => {
  lastOpenName = name ?? lastOpenName
})
watch(() => part.draft.sources.map(row => row.key), (keys) => {
  if (open.value !== undefined && !keys.includes(open.value))
    open.value = part.draft.sources.find(row => row.name === lastOpenName)?.key
})
</script>

<template>
  <PageSection id="data" title="Data Sources" rows>
    <template #actions>
      <Button ref="addButton" @click="add">
        Add a Data Source
      </Button>
    </template>
    <PluginRefreshInterval v-model:interval="part.draft.interval" :plugin-name="plugin.name" :error="part.errors.refreshInterval" />
    <DataSourceRows v-if="part.draft.sources.length > 0" v-model:open="open" class="sources">
      <PluginDataSourceRow
        v-for="(row, index) in part.draft.sources"
        :id="rowId(row.key)"
        :key="row.key"
        v-model:source="part.draft.sources[index]!"
        class="row"
        :path="paths[index]"
        :errors="part.errors"
        :facts="factsOf(row)"
        :plugin-name="plugin.name"
        @remove="remove(row)"
      />
    </DataSourceRows>
    <p v-else class="none">
      No Data Sources. The template renders without data. Add one to fetch JSON from an address, or to keep a fixed value.
    </p>
  </PageSection>
</template>

<style scoped>
@layer components {
  /* The section ends on the rule of its rows, so the last row draws none of its own. */
  .sources .row:last-child {
    border-bottom: 0;
  }

  /* A row the address names is scrolled to, and stops below the bar. */
  .sources .row {
    scroll-margin-top: calc(var(--bar-height) + var(--space-4));
  }

  .none {
    max-width: var(--measure);
    padding: var(--space-4) 0;
    border-top: var(--rule);
    color: var(--color-ink-soft);
  }
}
</style>
