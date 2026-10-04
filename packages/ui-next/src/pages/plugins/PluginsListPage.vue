<script setup lang="ts">
import type { PluginSummary } from 'kuroshiro-shared'
import type { PluginRowState } from './pluginRows'
import type { ShownPlugin } from './PluginRows.vue'
import type { Show } from './PluginsFilterBar.vue'
import type { RowMenuItem } from '@/components/rowMenuItem'
import { computed, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { listPlugins } from '@/api/plugins'
import Button from '@/components/Button.vue'
import EmptyState from '@/components/EmptyState.vue'
import Notice from '@/components/Notice.vue'
import LoadBody from '@/patterns/LoadBody.vue'
import TitleLine from '@/patterns/TitleLine.vue'
import { useLoad } from '@/patterns/useLoad'
import NoPluginsYet from './NoPluginsYet.vue'
import { useDuplicatePlugin, useExportPlugin } from './pluginActions'
import PluginDeletion from './PluginDeletion.vue'
import { addPluginPath } from './pluginPaths'
import { countLine, hasProblem, matchingPlugins, noMatchSentence, pluginRowState } from './pluginRows'
import PluginRows from './PluginRows.vue'
import PluginsFilterBar from './PluginsFilterBar.vue'

const SEARCH_ABOVE = 8
const route = useRoute()
const router = useRouter()

const plugins = useLoad(listPlugins, { fresh: true })
const duplication = useDuplicatePlugin()
const exporting = useExportPlugin()
const deleting = ref<PluginSummary>()

function holdInAddress(changes: { q?: string, show?: Show }) {
  void router.replace({ query: { ...route.query, ...changes } })
}

const query = computed({
  get: () => typeof route.query.q === 'string' ? route.query.q : '',
  set: sought => holdInAddress({ q: sought || undefined }),
})
const show = computed<Show>({
  get: () => route.query.show === 'problems' ? 'problems' : 'all',
  set: chosen => holdInAddress({ show: chosen === 'problems' ? chosen : undefined }),
})
const filter = computed(() => ({ query: query.value, problemsOnly: show.value === 'problems' }))

const all = computed(() => plugins.data ?? [])
const withProblem = computed(() => all.value.filter(hasProblem))
const shown = computed(() => matchingPlugins(all.value, filter.value))
const counted = computed(() => countLine({ total: all.value.length, shown: shown.value.length, withProblem: withProblem.value.length, ...filter.value }))

// A search held in the address stays reachable on a list too short to offer the field.
const offersSearch = computed(() => all.value.length > SEARCH_ABOVE || query.value !== '')
const offersFilter = computed(() => withProblem.value.length > 0)

function showAll() {
  holdInAddress({ q: undefined, show: undefined })
}

/** What an action of the row menu makes of the row's state column while it runs or has just run. */
function rowState(plugin: PluginSummary): PluginRowState | undefined {
  if (exporting.exported?.id === plugin.id)
    return { kind: 'note', text: 'Exported' }
  if (duplication.running?.id === plugin.id)
    return { kind: 'note', text: 'Duplicating' }
  return pluginRowState(plugin)
}

const announcement = computed(() => {
  if (exporting.exported)
    return `Exported ${exporting.exported.name}.`
  return duplication.running ? `Duplicating ${duplication.running.name}` : ''
})

function actionsOf(plugin: PluginSummary): RowMenuItem[] {
  return [
    { label: 'Duplicate', select: () => duplication.duplicate(plugin) },
    { label: 'Export', select: () => exporting.download(plugin) },
    { label: 'Delete Plugin', select: () => (deleting.value = plugin), ruleAbove: true },
  ]
}

const rows = computed<ShownPlugin[]>(() => shown.value.map(plugin => ({ plugin, state: rowState(plugin), actions: actionsOf(plugin) })))
</script>

<template>
  <TitleLine title="Plugins">
    <template v-if="all.length > 0" #actions>
      <Button as-child>
        <RouterLink :to="addPluginPath('poll')">
          Build a Plugin
        </RouterLink>
      </Button>
      <Button as-child variant="primary">
        <RouterLink :to="addPluginPath('recipe')">
          Import a Recipe
        </RouterLink>
      </Button>
    </template>
  </TitleLine>
  <LoadBody :load="plugins" loading="Loading Plugins" failed="Could not load the Plugins.">
    <NoPluginsYet v-if="all.length === 0" />
    <template v-else>
      <Notice
        v-if="duplication.failure"
        class="not-duplicated"
        :title="`Could not duplicate ${duplication.failure.plugin.name}.`"
        :reason="duplication.failure.reason"
        action="Try again"
        @act="duplication.duplicate(duplication.failure.plugin)"
      />
      <PluginsFilterBar v-model:query="query" v-model:show="show" :searchable="offersSearch" :filterable="offersFilter" />
      <p class="count">
        {{ counted }}
      </p>
      <PluginRows v-if="rows.length > 0" :rows="rows" />
      <EmptyState v-else class="none-match" title="No Plugin matches">
        {{ noMatchSentence(filter) }}
        <template #action>
          <Button @click="showAll">
            Show all Plugins
          </Button>
        </template>
      </EmptyState>
    </template>
    <template #skeleton>
      <PluginRows skeleton />
    </template>
  </LoadBody>
  <p class="visually-hidden" role="status">
    {{ announcement }}
  </p>
  <PluginDeletion
    v-if="deleting"
    :plugin="{ ...deleting, deviceNames: deleting.devices.map(device => device.name) }"
    @deleted="plugins.reload()"
    @closed="deleting = undefined"
  />
</template>

<style scoped>
@layer components {
  .not-duplicated {
    margin-bottom: var(--space-6);
  }

  .count {
    padding-bottom: var(--space-2);
    border-bottom: var(--rule-heavy);
    color: var(--color-ink-soft);
    font-size: var(--text-sm);
  }

  .empty-state.none-match {
    border-top: 0;
  }
}
</style>
